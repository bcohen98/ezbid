// Requires: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, LOVABLE_API_KEY
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response("Server configuration error", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("No signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook Error: ${err instanceof Error ? err.message : err}`, { status: 400 });
  }

  console.log(`[STRIPE-WEBHOOK] Event: ${event.type}`);

  try {
    switch (event.type) {
      // ── Subscription events (existing) ──
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          const { data: existingSubs } = await supabase
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .limit(1);

          let userId: string | null = existingSubs?.[0]?.user_id ?? null;
          let lookupEmail: string | null = null;

          if (!userId) {
            const email = session.customer_email || (session as any).customer_details?.email;
            lookupEmail = email;
            if (!lookupEmail && customerId) {
              const customer = await stripe.customers.retrieve(customerId);
              if (customer && !customer.deleted) {
                lookupEmail = (customer as Stripe.Customer).email;
              }
            }
            if (lookupEmail) {
              const { data: users } = await supabase.auth.admin.listUsers();
              const user = users?.users?.find((u) => u.email === lookupEmail);
              userId = user?.id ?? null;
            }
          }

          if (userId) {
            await supabase
              .from("user_subscriptions")
              .update({
                status: "active",
                plan: "pro",
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
              })
              .eq("user_id", userId);
            console.log(`[STRIPE-WEBHOOK] Activated subscription for user ${userId}`);

            // ── Ambassador prospect conversion ──
            const ambassadorProspectId = session.metadata?.ambassador_prospect_id;
            if (ambassadorProspectId) {
              try {
                const { data: prospect } = await supabase
                  .from("ambassador_prospects")
                  .update({ used: true, used_at: new Date().toISOString(), converted_user_id: userId })
                  .eq("id", ambassadorProspectId)
                  .eq("used", false)
                  .select()
                  .single();
                if (prospect) {
                  if (prospect.prospect_phone) {
                    await supabase.from("company_profiles").update({ prospect_phone: prospect.prospect_phone }).eq("user_id", userId);
                  }
                  const { data: ambProf } = await supabase.from("ambassador_profiles").select("total_conversions").eq("user_id", prospect.ambassador_id).single();
                  await supabase.from("ambassador_profiles").update({ total_conversions: (ambProf?.total_conversions || 0) + 1 }).eq("user_id", prospect.ambassador_id);
                  console.log(`[STRIPE-WEBHOOK] Marked ambassador prospect ${ambassadorProspectId} converted`);
                }
              } catch (e) {
                console.error("[STRIPE-WEBHOOK] Ambassador conversion error:", e);
              }
            }

            if (lookupEmail) {
              await processReferralConversion(supabase, stripe, lookupEmail, subscriptionId);
            }
          } else {
            console.error(`[STRIPE-WEBHOOK] Could not find user for customer ${customerId}`);
          }
        }

        if (session.mode === "payment") {
          const proposalId = session.metadata?.proposal_id;
          const userId = session.metadata?.user_id;
          const paymentType = session.metadata?.payment_type;

          console.log("[STRIPE-WEBHOOK] Payment session completed, proposal_id:", proposalId);

          if (!proposalId) {
            console.log("[STRIPE-WEBHOOK] No proposal_id in session metadata, skipping");
            break;
          }

          const amountTotal = session.amount_total ?? 0;
          const amountDollars = amountTotal / 100;
          const amountStr = amountDollars.toLocaleString("en-US", { minimumFractionDigits: 2 });

          const updateData: Record<string, any> = paymentType === "deposit"
            ? {
                payment_status: "deposit_paid",
                deposit_paid_at: new Date().toISOString(),
                deposit_paid_amount: amountDollars,
              }
            : {
                payment_status: "paid",
                payment_paid_at: new Date().toISOString(),
                payment_paid_amount: amountDollars,
              };

          await supabase.from("proposals").update(updateData).eq("id", proposalId);

          await supabase.from("payment_transactions")
            .update({ status: "succeeded" })
            .eq("proposal_id", proposalId)
            .eq("status", "pending");

          console.log("[STRIPE-WEBHOOK] Updated proposal", proposalId, "to", updateData.payment_status);

          const { data: proposal } = await supabase.from("proposals")
            .select("title, client_name, client_email, user_id")
            .eq("id", proposalId).single();
          const { data: profile } = await supabase.from("company_profiles")
            .select("email, company_name")
            .eq("user_id", userId || proposal?.user_id).single();

          const resendKey = Deno.env.get("RESEND_API_KEY");
          const lovableKey = Deno.env.get("LOVABLE_API_KEY");
          const PAYMENTS_FROM = "EZ-Bid Payments <payments@ezbid.pro>";

          if (resendKey && lovableKey) {
            if (profile?.email) {
              await fetch("https://connector-gateway.lovable.dev/resend/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${lovableKey}`,
                  "X-Connection-Api-Key": resendKey,
                },
                body: JSON.stringify({
                  from: PAYMENTS_FROM,
                  to: [profile.email],
                  reply_to: profile.email,
                  subject: `Payment Received — ${proposal?.title || "Proposal"}`,
                  html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:30px 20px;"><h1 style="font-size:22px;color:#1a1a1a;">Payment Received! 💰</h1><p style="font-size:15px;color:#555;line-height:1.6;"><strong>${proposal?.client_name || "Your client"}</strong> has paid <strong>$${amountStr}</strong> for <strong>${proposal?.title || "your proposal"}</strong>. The funds are being transferred to your bank account.</p><p style="font-size:13px;color:#888;">Funds typically arrive next business day.</p></div>`,
                }),
              });
            }

            if (proposal?.client_email) {
              await fetch("https://connector-gateway.lovable.dev/resend/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${lovableKey}`,
                  "X-Connection-Api-Key": resendKey,
                },
                body: JSON.stringify({
                  from: PAYMENTS_FROM,
                  to: [proposal.client_email],
                  reply_to: profile?.email || "payments@ezbid.pro",
                  subject: `Payment Confirmed — ${proposal?.title || "Proposal"}`,
                  html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:30px 20px;"><h1 style="font-size:22px;color:#1a1a1a;">Payment Confirmed ✓</h1><p style="font-size:15px;color:#555;line-height:1.6;">Your payment of <strong>$${amountStr}</strong> to <strong>${profile?.company_name || "your contractor"}</strong> has been received. Thank you!</p><p style="font-size:12px;color:#999;margin-top:20px;">— ${profile?.company_name || "Your contractor"}</p></div>`,
                }),
              });
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const { data: subs } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .limit(1);

        if (subs && subs.length > 0) {
          const isActive = subscription.status === "active" || subscription.status === "trialing";
          await supabase
            .from("user_subscriptions")
            .update({
              status: isActive ? "active" : "canceled",
              plan: isActive ? "pro" : "starter",
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        await supabase
          .from("user_subscriptions")
          .update({ status: "canceled", plan: "starter" })
          .eq("stripe_customer_id", customerId);
        break;
      }

      // ── Connect payment events (new) ──
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const proposalId = pi.metadata?.proposal_id;
        const paymentType = pi.metadata?.payment_type;
        const userId = pi.metadata?.user_id;

        if (!proposalId || !paymentType) {
          console.log("[STRIPE-WEBHOOK] payment_intent.succeeded without proposal metadata, skipping");
          break;
        }

        const amountDollars = pi.amount / 100;
        const platformFeeDollars = (pi.application_fee_amount || 0) / 100;

        // Estimate Stripe fee (2.9% + $0.30)
        const stripeFee = Math.round((pi.amount * 0.029 + 30)) / 100;
        const netAmount = amountDollars - stripeFee - platformFeeDollars;

        // Update transaction
        await supabase
          .from("payment_transactions")
          .update({
            status: "succeeded",
            stripe_payment_intent_id: pi.id,
            stripe_fee: stripeFee,
            net_amount: netAmount,
          })
          .eq("proposal_id", proposalId)
          .eq("status", "pending")
          .eq("type", paymentType);

        // Update proposal
        if (paymentType === "deposit") {
          await supabase.from("proposals").update({
            payment_status: "deposit_paid",
            deposit_paid_at: new Date().toISOString(),
            deposit_paid_amount: amountDollars,
          }).eq("id", proposalId);
        } else {
          await supabase.from("proposals").update({
            payment_status: "paid",
            payment_paid_at: new Date().toISOString(),
            payment_paid_amount: amountDollars,
          }).eq("id", proposalId);
        }

        // Send confirmation emails
        if (userId) {
          const { data: proposal } = await supabase.from("proposals").select("title, client_name, client_email").eq("id", proposalId).single();
          const { data: profile } = await supabase.from("company_profiles").select("company_name, email").eq("user_id", userId).single();
          
          const resendKey = Deno.env.get("RESEND_API_KEY");
          const lovableKey = Deno.env.get("LOVABLE_API_KEY");

          if (resendKey && lovableKey && proposal) {
            const amountStr = amountDollars.toLocaleString("en-US", { minimumFractionDigits: 2 });
            const PAYMENTS_FROM = "EZ-Bid Payments <payments@ezbid.pro>";
            // Email to contractor
            if (profile?.email) {
              await fetch("https://connector-gateway.lovable.dev/resend/emails", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": resendKey },
                body: JSON.stringify({
                  from: PAYMENTS_FROM,
                  to: [profile.email],
                  subject: `Payment Received — ${proposal.title || "Proposal"}`,
                  html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:30px 20px;"><h1 style="font-size:22px;color:#1a1a1a;">Payment Received! 💰</h1><p style="font-size:15px;color:#555;line-height:1.6;"><strong>${proposal.client_name || "Your client"}</strong> has paid <strong>$${amountStr}</strong> for <strong>${proposal.title || "your proposal"}</strong>. The funds are being transferred to your bank account.</p><p style="font-size:13px;color:#888;">Funds typically arrive next business day.</p></div>`,
                }),
              });
            }
            // Email to client
            if (proposal.client_email) {
              const clientEmailPayload: Record<string, any> = {
                from: PAYMENTS_FROM,
                to: [proposal.client_email],
                subject: `Payment Confirmed — ${proposal.title || "Proposal"}`,
                html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:30px 20px;"><h1 style="font-size:22px;color:#1a1a1a;">Payment Confirmed ✓</h1><p style="font-size:15px;color:#555;line-height:1.6;">Your payment of <strong>$${amountStr}</strong> to <strong>${profile?.company_name || "your contractor"}</strong> has been received. Thank you!</p><p style="font-size:12px;color:#999;margin-top:20px;">— ${profile?.company_name || "Your contractor"}</p></div>`,
              };
              if (profile?.email) clientEmailPayload.reply_to = profile.email;
              await fetch("https://connector-gateway.lovable.dev/resend/emails", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": resendKey },
                body: JSON.stringify(clientEmailPayload),
              });
            }
          }
        }

        console.log(`[STRIPE-WEBHOOK] Payment succeeded for proposal ${proposalId}: $${amountDollars}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const proposalId = pi.metadata?.proposal_id;
        const paymentType = pi.metadata?.payment_type;

        if (!proposalId) break;

        await supabase
          .from("payment_transactions")
          .update({ status: "failed" })
          .eq("proposal_id", proposalId)
          .eq("status", "pending")
          .eq("type", paymentType || "full_payment");

        // Revert proposal status
        const { data: proposal } = await supabase.from("proposals").select("payment_status, deposit_paid_amount").eq("id", proposalId).single();
        if (proposal) {
          let revertStatus = "unpaid";
          if (paymentType === "full_payment" && Number(proposal.deposit_paid_amount) > 0) {
            revertStatus = "deposit_paid";
          }
          await supabase.from("proposals").update({ payment_status: revertStatus }).eq("id", proposalId);
        }

        console.log(`[STRIPE-WEBHOOK] Payment failed for proposal ${proposalId}`);
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const { data: profiles } = await supabase
          .from("company_profiles")
          .select("user_id")
          .eq("stripe_connect_account_id", account.id);

        if (profiles && profiles.length > 0) {
          await supabase
            .from("company_profiles")
            .update({
              stripe_connect_onboarded: account.details_submitted ?? false,
              stripe_connect_charges_enabled: account.charges_enabled ?? false,
              stripe_connect_payouts_enabled: account.payouts_enabled ?? false,
            })
            .eq("stripe_connect_account_id", account.id);
          console.log(`[STRIPE-WEBHOOK] Updated Connect account status for ${account.id}`);
        }
        break;
      }

      default:
        console.log(`[STRIPE-WEBHOOK] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[STRIPE-WEBHOOK] Error processing ${event.type}:`, err);
    return new Response("Webhook handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});

// ── Referral conversion helper ──
async function processReferralConversion(
  supabase: ReturnType<typeof createClient>,
  stripe: Stripe,
  email: string,
  subscriptionId: string
) {
  try {
    const { data: referral } = await supabase
      .from("referrals")
      .select("*")
      .eq("referred_email", email.toLowerCase())
      .eq("status", "signed_up")
      .limit(1)
      .maybeSingle();

    if (!referral) return;

    await supabase
      .from("referrals")
      .update({
        status: "converted",
        converted_at: new Date().toISOString(),
        stripe_subscription_id: subscriptionId,
        credit_applied: true,
      })
      .eq("id", referral.id);

    await supabase.from("referral_credits").insert({
      user_id: referral.referrer_user_id,
      referral_id: referral.id,
      credit_months: 1,
    });

    const { data: referrerSub } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", referral.referrer_user_id)
      .maybeSingle();

    if (referrerSub?.stripe_customer_id) {
      await stripe.customers.createBalanceTransaction(referrerSub.stripe_customer_id, {
        amount: -2900,
        currency: "usd",
        description: `Referral credit: ${email} subscribed`,
      });

      await supabase
        .from("referral_credits")
        .update({ applied_at: new Date().toISOString() })
        .eq("referral_id", referral.id)
        .eq("user_id", referral.referrer_user_id);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (resendApiKey && lovableApiKey) {
      const { data: referrerProfile } = await supabase
        .from("company_profiles")
        .select("email")
        .eq("user_id", referral.referrer_user_id)
        .maybeSingle();

      if (referrerProfile?.email) {
        await fetch("https://connector-gateway.lovable.dev/resend/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableApiKey}`,
            "X-Connection-Api-Key": resendApiKey,
          },
          body: JSON.stringify({
            from: "EZ-Bid <onboarding@resend.dev>",
            to: [referrerProfile.email],
            subject: "Your referral just subscribed! 🎉",
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:30px 20px;"><h1 style="font-size:22px;font-weight:bold;color:#1a1a1a;">Great news!</h1><p style="font-size:15px;color:#555;line-height:1.6;">Your referral (${email}) just subscribed to EZ-Bid Pro! We've added <strong>1 free month ($29)</strong> as a credit to your account.</p><p style="font-size:12px;color:#999;margin-top:30px;">— The EZ-Bid Team</p></div>`,
          }),
        });
      }
    }

    console.log(`[STRIPE-WEBHOOK] Referral conversion processed for ${email}`);
  } catch (err) {
    console.error("[STRIPE-WEBHOOK] Referral conversion error:", err);
  }
}
