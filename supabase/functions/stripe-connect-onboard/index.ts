// Stripe Connect onboarding — creates Express account if missing, returns onboarding link.
// Requires: STRIPE_SECRET_KEY, APP_URL. Stripe Connect must be enabled on the platform account.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FN = "stripe-connect-onboard";

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log(`[${FN}] start`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://ezbid.pro";

    if (!supabaseUrl || !supabaseAnon || !serviceKey) {
      console.error(`[${FN}] missing supabase env`);
      return jsonResp({ error: "Server configuration error: Supabase env missing." }, 500);
    }
    if (!stripeKey) {
      console.error(`[${FN}] missing STRIPE_SECRET_KEY`);
      return jsonResp({ error: "Server configuration error: STRIPE_SECRET_KEY not set." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResp({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, supabaseAnon);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) {
      console.error(`[${FN}] auth failed`, authErr?.message);
      return jsonResp({ error: "Unauthorized" }, 401);
    }
    console.log(`[${FN}] user: ${user.id}`);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: profile, error: profErr } = await adminClient
      .from("company_profiles")
      .select("stripe_connect_account_id, email")
      .eq("user_id", user.id)
      .single();
    if (profErr) console.warn(`[${FN}] profile lookup warn:`, profErr.message);

    let accountId = profile?.stripe_connect_account_id;
    console.log(`[${FN}] existing account_id: ${accountId || "(none)"}`);

    if (!accountId) {
      console.log(`[${FN}] creating new Express account`);
      try {
        const account = await stripe.accounts.create({
          type: "express",
          country: "US",
          email: profile?.email || user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });
        accountId = account.id;
        console.log(`[${FN}] created account_id: ${accountId}`);
        await adminClient
          .from("company_profiles")
          .update({ stripe_connect_account_id: accountId })
          .eq("user_id", user.id);
      } catch (createErr: any) {
        console.error(`[${FN}] stripe.accounts.create failed:`, createErr?.message, createErr?.raw?.message);
        const msg = createErr?.raw?.message || createErr?.message || "Stripe account creation failed";
        // Friendly hint when Connect isn't enabled on the platform Stripe account
        if (/sign(ed)? up for Connect/i.test(msg)) {
          return jsonResp({
            error: "Stripe Connect is not enabled on the platform Stripe account. The platform owner must enable Connect at https://dashboard.stripe.com/connect before contractors can onboard.",
            code: "CONNECT_NOT_ENABLED",
          }, 400);
        }
        return jsonResp({ error: msg, code: "STRIPE_CREATE_FAILED" }, 400);
      }
    }

    console.log(`[${FN}] creating accountLink for ${accountId}`);
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/company-profile?stripe=refresh`,
      return_url: `${appUrl}/company-profile?stripe=success`,
      type: "account_onboarding",
    });
    console.log(`[${FN}] returning url to client`);

    return jsonResp({ url: accountLink.url });
  } catch (err: any) {
    console.error(`[${FN}] UNHANDLED:`, err?.message, err?.stack);
    return jsonResp({ error: err?.message || "Unknown error" }, 500);
  }
});
