// Requires: STRIPE_SECRET_KEY
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_CONNECT")!;

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, supabaseAnon);
    const {
      data: { user },
      error: authErr,
    } = await anonClient.auth.getUser(token);
    if (authErr || !user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: profile } = await adminClient
      .from("company_profiles")
      .select("stripe_connect_account_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.stripe_connect_account_id) {
      return new Response(JSON.stringify({ connected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const account = await stripe.accounts.retrieve(profile.stripe_connect_account_id);

    await adminClient
      .from("company_profiles")
      .update({
        stripe_connect_onboarded: account.details_submitted ?? false,
        stripe_connect_charges_enabled: account.charges_enabled ?? false,
        stripe_connect_payouts_enabled: account.payouts_enabled ?? false,
      })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({
        connected: true,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        account_id: profile.stripe_connect_account_id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("[stripe-connect-status]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
