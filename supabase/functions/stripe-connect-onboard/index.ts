// v3 - force redeploy
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_CONNECT")!;

    console.log("[stripe-connect-onboard] v3 start");
    console.log("[stripe-connect-onboard] stripeKey present:", !!stripeKey);

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY_CONNECT not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, supabaseAnon);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[stripe-connect-onboard] user:", user.id);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: profile } = await adminClient
      .from("company_profiles")
      .select("stripe_connect_account_id, email")
      .eq("user_id", user.id)
      .single();

    let accountId = profile?.stripe_connect_account_id;
    console.log("[stripe-connect-onboard] existing account_id:", accountId || "(none)");

    if (!accountId) {
      console.log("[stripe-connect-onboard] creating new Express account");
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
      console.log("[stripe-connect-onboard] created account_id:", accountId);
      await adminClient
        .from("company_profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("user_id", user.id);
    }

    const return_url = "https://ezbid.pro/profile?connect=success";
    const refresh_url = "https://ezbid.pro/profile?connect=refresh";

    console.log("[stripe-connect-onboard] return_url:", return_url);
    console.log("[stripe-connect-onboard] refresh_url:", refresh_url);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      return_url: return_url,
      refresh_url: refresh_url,
      type: "account_onboarding",
    });

    console.log("[stripe-connect-onboard] success url:", accountLink.url);

    return new Response(JSON.stringify({ url: accountLink.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[stripe-connect-onboard] UNHANDLED:", err.message, err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
