// v3 force redeploy
// Requires: STRIPE_SECRET_KEY_CONNECT, RESEND_API_KEY, LOVABLE_API_KEY
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYMENTS_FROM = "EZ-Bid Payments <payments@ezbid.pro>";
const APP_URL = "https://ezbid.pro";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY_CONNECT")!;

    console.log("[create-payment-link] v2 start");

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY_CONNECT not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, supabaseAnon);
    const {
      data: { user },
      error: authErr,
    } = await anonClient.auth.getUser(token);
    if (authErr || !user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const {
      proposal_id,
      payment_type,
      amount: amountOverride,
      client_email: clientEmailOverride,
      personal_message,
      description: descriptionOverride,
    } = await req.json();

    if (!proposal_id || !payment_type) {
      return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { data: proposal } = await adminClient
      .from("proposals")
      .select("*")
      .eq("id", proposal_id)
      .eq("user_id", user.id)
      .single();
    if (!proposal)
      return new Response(JSON.stringify({ error: "Proposal not found" }), { status: 404, headers: corsHeaders });

    const { data: profile } = await adminClient
      .from("company_profiles")
      .select("stripe_connect_account_id, stripe_connect_charges_enabled, company_name, email")
      .eq("user_id", user.id)
      .single();

    if (!profile?.stripe_connect_account_id) {
      return new Response(JSON.stringify({ error: "Stripe Connect not configured" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    let amount: number;
    const typeLabel = payment_type === "deposit" ? "Deposit" : "Payment";
    if (amountOverride !== undefined && amountOverride !== null && amountOverride !== "") {
      amount = Number(amountOverride);
    } else if (payment_type === "deposit") {
      amount = Number(proposal.deposit_amount) || 0;
    } else {
      const depositPaid = Number(proposal.deposit_paid_amount) || 0;
      amount = (Number(proposal.total) || 0) - depositPaid;
    }

    if (!amount || amount <= 0 || isNaN(amount)) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), { status: 400, headers: corsHeaders });
    }

    const clientEmail = (clientEmailOverride && String(clientEmailOverride).trim()) || proposal.client_email;
    const description =
      (descriptionOverride && String(descriptionOverride).trim()) || `${proposal.title || "Proposal"} — ${typeLabel}`;

    const amountCents = Math.round(amount * 100);
    const platformFeeCents = Math.round(amountCents * 0.01);

    const redirectUrl = `${APP_URL}/payment-complete?proposal=${proposal_id}`;
    console.log("[create-payment-link] redirect url:", redirectUrl);

    const price = await stripe.prices.create({
      unit_amount: amountCents,
      currency: "usd",
      product_data: { name: description },
    });

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: profile.stripe_connect_account_id },
      after_completion: {
        type: "redirect",
        redirect: { url: redirectUrl },
      },
      metadata: { proposal_id, user_id: user.id, payment_type },
    });

    console.log("[create-payment-link] payment link created:", paymentLink.url);

    const update: Record<string, any> = {
      payment_requested_at: new Date().toISOString(),
      payment_link_url: paymentLink.url,
    };
    if (payment_type === "deposit") {
      update.payment_status = "deposit_requested";
    } else {
      update.payment_status = "payment_requested";
    }
    await adminClient.from("proposals").update(update).eq("id", proposal_id);

    await adminClient.from("payment_transactions").insert({
      proposal_id,
      user_id: user.id,
      amount,
      type: payment_type,
      status: "pending",
      client_name: proposal.client_name,
      client_email: clientEmail,
      platform_fee: platformFeeCents / 100,
    });

    if (clientEmail) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (resendKey && lovableKey) {
        const companyName = profile.company_name || "your contractor";
        const messageBlock =
          personal_message && String(personal_message).trim()
            ? `<div style="margin:20px 0;padding:16px 18px;background:#f7f7f8;border-left:3px solid #1a1a1a;border-radius:4px;"><p style="font-size:14px;color:#333;line-height:1.6;margin:0;white-space:pre-wrap;">${String(personal_message).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</p></div>`
            : "";
        const emailPayload: Record<string, any> = {
          from: PAYMENTS_FROM,
          to: [clientEmail],
          subject: `Payment Request from ${companyName}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:30px 20px;">
              <h1 style="font-size:22px;font-weight:bold;color:#1a1a1a;margin:0 0 8px;">Payment Request</h1>
              <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 16px;">
                ${companyName} is requesting a ${typeLabel.toLowerCase()} for:
              </p>
              <p style="font-size:15px;color:#1a1a1a;font-weight:bold;margin:0 0 4px;">${proposal.title || "Proposal"}</p>
              <p style="font-size:13px;color:#666;margin:0 0 16px;">${description}</p>
              ${messageBlock}
              <div style="margin:25px 0;text-align:center;">
                <a href="${paymentLink.url}" style="display:inline-block;padding:14px 32px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:bold;">
                  Pay Now — $${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </a>
              </div>
              <p style="font-size:13px;color:#888;">Secure payment powered by Stripe. Your payment information is never shared with the contractor.</p>
            </div>
          `,
        };
        if (profile.email) emailPayload.reply_to = profile.email;

        await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": resendKey,
          },
          body: JSON.stringify(emailPayload),
        });
      }
    }

    return new Response(JSON.stringify({ payment_link_url: paymentLink.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[create-payment-link]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
