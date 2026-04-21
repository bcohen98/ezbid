import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// NEW list-price IDs ($36/mo, $360/yr). Promo code applies a coupon to bring back to $29/$290 for 12 months.
const PRICES: Record<string, string> = {
  monthly: "price_1TOmOLFZyh1CtRKqIyf1o7gn",
  annual: "price_1TOmUoFZyh1CtRKq19aZZTQj",
};

// Coupon IDs we auto-create on first use
const COUPON_IDS = {
  monthly: "ambassador_monthly_7off",
  annual: "ambassador_annual_70off",
};

async function ensureCoupon(stripe: Stripe, plan: "monthly" | "annual") {
  const id = COUPON_IDS[plan];
  try {
    return await stripe.coupons.retrieve(id);
  } catch {
    // Create
    const params: Stripe.CouponCreateParams = plan === "monthly"
      ? { id, name: "Ambassador Monthly $7 Off (12 months)", amount_off: 700, currency: "usd", duration: "repeating", duration_in_months: 12 }
      : { id, name: "Ambassador Annual $70 Off (first year)", amount_off: 7000, currency: "usd", duration: "once" };
    return await stripe.coupons.create(params);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }
    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !data.user?.email) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 });
    }
    const user = data.user;

    let plan: "monthly" | "annual" = "monthly";
    let promoCode: string | undefined;
    try {
      const body = await req.json();
      if (body?.plan === "annual") plan = "annual";
      if (typeof body?.promo_code === "string" && body.promo_code.trim()) promoCode = body.promo_code.trim().toUpperCase();
    } catch { /* default monthly */ }

    const priceId = PRICES[plan];
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Validate promo code if present
    let validatedProspectId: string | undefined;
    let couponId: string | undefined;
    if (promoCode) {
      const adminClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      const { data: prospect } = await adminClient
        .from("ambassador_prospects")
        .select("id, expires_at, used")
        .eq("code", promoCode)
        .maybeSingle();
      if (prospect && !prospect.used && new Date(prospect.expires_at) > new Date()) {
        validatedProspectId = prospect.id;
        const coupon = await ensureCoupon(stripe, plan);
        couponId = coupon.id;
      } else {
        console.log("[create-pro-checkout] Invalid promo, ignoring:", promoCode);
      }
    }

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const origin = req.headers.get("origin") || "https://ezbid.lovable.app";
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/dashboard?upgrade=success`,
      cancel_url: `${origin}/proposals/new?upgrade=cancelled`,
      metadata: validatedProspectId ? { ambassador_prospect_id: validatedProspectId, promo_code: promoCode || "", user_id: user.id } : { user_id: user.id },
    };
    if (couponId) {
      sessionParams.discounts = [{ coupon: couponId }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[create-pro-checkout] ERROR:", msg);
    return new Response(JSON.stringify({ error: msg }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
