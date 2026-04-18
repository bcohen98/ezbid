// Stripe Connect onboarding — creates Express account if missing, returns onboarding link.
// Tries STRIPE_SECRET_KEY first, falls back to STRIPE_SECRET_KEY_CONNECT if Connect isn't enabled.
// GET request returns a diagnostic payload to help identify which Stripe account is in use.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const FN = "stripe-connect-onboard";

function jsonResp(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isConnectNotEnabled(err: any): boolean {
  const msg = err?.raw?.message || err?.message || "";
  return /sign(ed)? up for Connect/i.test(msg);
}

async function tryCreateAccount(stripe: Stripe, email: string | undefined) {
  return await stripe.accounts.create({
    type: "express",
    country: "US",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const lovableKey = Deno.env.get("STRIPE_SECRET_KEY");
  const customKey = Deno.env.get("STRIPE_SECRET_KEY_CONNECT");

  // ── Diagnostic GET endpoint ─────────────────────────────────────────
  if (req.method === "GET") {
    const diag: Record<string, unknown> = {
      STRIPE_SECRET_KEY_present: !!lovableKey,
      STRIPE_SECRET_KEY_CONNECT_present: !!customKey,
      keys_tested: [] as Array<Record<string, unknown>>,
    };
    const sources: Array<{ source: string; key: string | undefined }> = [
      { source: "lovable_managed (STRIPE_SECRET_KEY)", key: lovableKey },
      { source: "custom (STRIPE_SECRET_KEY_CONNECT)", key: customKey },
    ];
    for (const { source, key } of sources) {
      if (!key) continue;
      const entry: Record<string, unknown> = { source };
      try {
        const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
        const acct = await stripe.accounts.retrieve();
        entry.account_id = acct.id;
        entry.country = acct.country;
        entry.charges_enabled = acct.charges_enabled;
        // Probe Connect by attempting a no-op listing
        try {
          await stripe.accounts.list({ limit: 1 });
          entry.connect_enabled = true;
        } catch (probeErr: any) {
          entry.connect_enabled = !isConnectNotEnabled(probeErr);
          entry.connect_probe_error = probeErr?.raw?.message || probeErr?.message;
        }
      } catch (err: any) {
        entry.error = err?.raw?.message || err?.message;
      }
      (diag.keys_tested as any[]).push(entry);
    }
    return jsonResp(diag);
  }

  try {
    console.log(`[${FN}] start`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://ezbid.pro";

    if (!supabaseUrl || !supabaseAnon || !serviceKey) {
      console.error(`[${FN}] missing supabase env`);
      return jsonResp({ error: "Server configuration error: Supabase env missing." }, 500);
    }
    if (!lovableKey && !customKey) {
      console.error(`[${FN}] no Stripe key configured`);
      return jsonResp({ error: "Server configuration error: no Stripe secret key set." }, 500);
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

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: profile, error: profErr } = await adminClient
      .from("company_profiles")
      .select("stripe_connect_account_id, email")
      .eq("user_id", user.id)
      .single();
    if (profErr) console.warn(`[${FN}] profile lookup warn:`, profErr.message);

    let accountId = profile?.stripe_connect_account_id;
    console.log(`[${FN}] existing account_id: ${accountId || "(none)"}`);

    // Pick initial key — prefer lovable-managed, fall back to custom
    let keySource: "lovable_managed" | "custom" = lovableKey ? "lovable_managed" : "custom";
    let activeKey = lovableKey || customKey!;
    let stripe = new Stripe(activeKey, { apiVersion: "2025-08-27.basil" });
    console.log(`[STRIPE] using key source: ${keySource}`);

    if (!accountId) {
      console.log(`[${FN}] creating new Express account`);
      try {
        const account = await tryCreateAccount(stripe, profile?.email || user.email);
        accountId = account.id;
      } catch (createErr: any) {
        console.error(`[${FN}] create with ${keySource} failed:`, createErr?.raw?.message || createErr?.message);
        // Fallback: if Connect isn't enabled on the lovable-managed key, try the custom key
        if (isConnectNotEnabled(createErr) && keySource === "lovable_managed" && customKey) {
          console.log(`[STRIPE] retrying with key source: custom`);
          keySource = "custom";
          activeKey = customKey;
          stripe = new Stripe(activeKey, { apiVersion: "2025-08-27.basil" });
          try {
            const account = await tryCreateAccount(stripe, profile?.email || user.email);
            accountId = account.id;
          } catch (retryErr: any) {
            console.error(`[${FN}] retry with custom key failed:`, retryErr?.raw?.message || retryErr?.message);
            const msg = retryErr?.raw?.message || retryErr?.message || "Stripe account creation failed";
            if (isConnectNotEnabled(retryErr)) {
              return jsonResp({
                error: "Stripe Connect is not enabled on either configured Stripe account. Enable Connect at https://dashboard.stripe.com/connect.",
                code: "CONNECT_NOT_ENABLED",
              }, 400);
            }
            return jsonResp({ error: msg, code: "STRIPE_CREATE_FAILED" }, 400);
          }
        } else {
          const msg = createErr?.raw?.message || createErr?.message || "Stripe account creation failed";
          if (isConnectNotEnabled(createErr)) {
            return jsonResp({
              error: "Stripe Connect is not enabled on the configured Stripe account. Enable Connect at https://dashboard.stripe.com/connect.",
              code: "CONNECT_NOT_ENABLED",
            }, 400);
          }
          return jsonResp({ error: msg, code: "STRIPE_CREATE_FAILED" }, 400);
        }
      }
      console.log(`[${FN}] created account_id: ${accountId} via ${keySource}`);
      await adminClient
        .from("company_profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("user_id", user.id);
    }

    console.log(`[${FN}] creating accountLink for ${accountId} (key: ${keySource})`);
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/company-profile?stripe=refresh`,
      return_url: `${appUrl}/company-profile?stripe=success`,
      type: "account_onboarding",
    });
    console.log(`[${FN}] returning url to client`);

    return jsonResp({ url: accountLink.url, key_source: keySource });
  } catch (err: any) {
    console.error(`[${FN}] UNHANDLED:`, err?.message, err?.stack);
    return jsonResp({ error: err?.message || "Unknown error" }, 500);
  }
});
