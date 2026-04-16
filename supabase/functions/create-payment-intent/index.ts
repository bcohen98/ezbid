// Requires: STRIPE_SECRET_KEY
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
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, supabaseAnon);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { proposal_id, payment_type, amount_override } = await req.json();
    if (!proposal_id || !payment_type) {
      return new Response(JSON.stringify({ error: "Missing proposal_id or payment_type" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch proposal
    const { data: proposal, error: pErr } = await adminClient
      .from("proposals")
      .select("*")
      .eq("id", proposal_id)
      .eq("user_id", user.id)
      .single();
    if (pErr || !proposal) return new Response(JSON.stringify({ error: "Proposal not found" }), { status: 404, headers: corsHeaders });

    // Fetch connect account
    const { data: profile } = await adminClient
      .from("company_profiles")
      .select("stripe_connect_account_id, stripe_connect_charges_enabled")
      .eq("user_id", user.id)
      .single();
    if (!profile?.stripe_connect_account_id || !profile.stripe_connect_charges_enabled) {
      return new Response(JSON.stringify({ error: "Stripe Connect not set up or charges not enabled" }), { status: 400, headers: corsHeaders });
    }

    // Determine amount
    let amount: number;
    if (amount_override != null) {
      amount = Number(amount_override);
    } else if (payment_type === "deposit") {
      amount = Number(proposal.deposit_amount) || 0;
    } else {
      const depositPaid = Number(proposal.deposit_paid_amount) || 0;
      amount = (Number(proposal.total) || 0) - depositPaid;
    }

    if (amount <= 0) return new Response(JSON.stringify({ error: "Invalid amount" }), { status: 400, headers: corsHeaders });

    const amountCents = Math.round(amount * 100);
    const platformFeeCents = Math.round(amountCents * 0.01);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: profile.stripe_connect_account_id },
      metadata: { proposal_id, user_id: user.id, payment_type },
      receipt_email: proposal.client_email || undefined,
      description: `Payment for: ${proposal.title || "Proposal"}`,
    });

    // Update proposal
    const proposalUpdate: Record<string, any> = { payment_requested_at: new Date().toISOString() };
    if (payment_type === "deposit") {
      proposalUpdate.stripe_deposit_intent_id = paymentIntent.id;
      proposalUpdate.payment_status = "deposit_requested";
    } else {
      proposalUpdate.stripe_payment_intent_id = paymentIntent.id;
      proposalUpdate.payment_status = "payment_requested";
    }
    await adminClient.from("proposals").update(proposalUpdate).eq("id", proposal_id);

    // Insert transaction
    await adminClient.from("payment_transactions").insert({
      proposal_id,
      user_id: user.id,
      stripe_payment_intent_id: paymentIntent.id,
      amount,
      type: payment_type,
      status: "pending",
      client_name: proposal.client_name,
      client_email: proposal.client_email,
      platform_fee: platformFeeCents / 100,
    });

    return new Response(JSON.stringify({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount,
      platform_fee: platformFeeCents / 100,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[create-payment-intent]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
