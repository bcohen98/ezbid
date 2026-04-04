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
        if (session.mode === "subscription" && session.customer_email) {
          const { data: users } = await supabase.auth.admin.listUsers();
          const user = users?.users?.find((u) => u.email === session.customer_email);
          if (user) {
            await supabase
              .from("user_subscriptions")
              .update({
                status: "active",
                plan: "pro",
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: session.subscription as string,
              })
              .eq("user_id", user.id);
            console.log(`[STRIPE-WEBHOOK] Activated subscription for ${user.email}`);
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
