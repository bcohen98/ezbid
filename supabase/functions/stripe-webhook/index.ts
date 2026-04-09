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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription") {
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;

          // Try to find user by stripe_customer_id first
          const { data: existingSubs } = await supabase
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .limit(1);

          let userId: string | null = existingSubs?.[0]?.user_id ?? null;

          // Fallback: look up by email from session or Stripe customer
          let lookupEmail: string | null = null;
          if (!userId) {
            const email = session.customer_email
              || (session as any).customer_details?.email;
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

            // ── Referral conversion check ──
            if (lookupEmail) {
              await processReferralConversion(supabase, stripe, lookupEmail, subscriptionId);
            }
          } else {
            console.error(`[STRIPE-WEBHOOK] Could not find user for customer ${customerId}`);
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
          console.log(`[STRIPE-WEBHOOK] Updated subscription for customer ${customerId}: ${subscription.status}`);
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
        console.log(`[STRIPE-WEBHOOK] Canceled subscription for customer ${customerId}`);
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
    // Find a referral for this email that is signed_up (not yet converted)
    const { data: referral } = await supabase
      .from("referrals")
      .select("*")
      .eq("referred_email", email.toLowerCase())
      .eq("status", "signed_up")
      .limit(1)
      .maybeSingle();

    if (!referral) return;

    // Update referral to converted
    await supabase
      .from("referrals")
      .update({
        status: "converted",
        converted_at: new Date().toISOString(),
        stripe_subscription_id: subscriptionId,
        credit_applied: true,
      })
      .eq("id", referral.id);

    // Create credit for referrer
    await supabase.from("referral_credits").insert({
      user_id: referral.referrer_user_id,
      referral_id: referral.id,
      credit_months: 1,
    });

    // Apply credit to referrer's Stripe subscription
    const { data: referrerSub } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", referral.referrer_user_id)
      .maybeSingle();

    if (referrerSub?.stripe_customer_id) {
      // Add negative balance (credit) of $29 (one month)
      await stripe.customers.createBalanceTransaction(referrerSub.stripe_customer_id, {
        amount: -2900, // -$29.00 in cents
        currency: "usd",
        description: `Referral credit: ${email} subscribed`,
      });

      console.log(`[STRIPE-WEBHOOK] Applied $29 referral credit to customer ${referrerSub.stripe_customer_id}`);

      // Update the credit record
      await supabase
        .from("referral_credits")
        .update({ applied_at: new Date().toISOString() })
        .eq("referral_id", referral.id)
        .eq("user_id", referral.referrer_user_id);
    }

    // Send congratulations email to referrer
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
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 30px 20px;">
                <h1 style="font-size: 22px; font-weight: bold; color: #1a1a1a;">Great news!</h1>
                <p style="font-size: 15px; color: #555; line-height: 1.6;">
                  Your referral (${email}) just subscribed to EZ-Bid Pro! 
                  We've added <strong>1 free month ($29)</strong> as a credit to your account. 
                  It'll be automatically applied to your next billing cycle.
                </p>
                <p style="font-size: 15px; color: #555; line-height: 1.6;">
                  Keep referring — there's no cap on how many free months you can earn!
                </p>
                <p style="font-size: 12px; color: #999; margin-top: 30px;">— The EZ-Bid Team</p>
              </div>
            `,
          }),
        });
      }
    }

    console.log(`[STRIPE-WEBHOOK] Referral conversion processed for ${email}, referrer: ${referral.referrer_user_id}`);
  } catch (err) {
    console.error("[STRIPE-WEBHOOK] Referral conversion error:", err);
  }
}
