import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { email, referralCode } = await req.json();
    if (!email || !referralCode) {
      return new Response(JSON.stringify({ error: "Missing email or referralCode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the referral code
    const { data: codeRow } = await client
      .from("referral_codes")
      .select("user_id")
      .eq("code", referralCode.toUpperCase())
      .maybeSingle();

    if (!codeRow) {
      return new Response(JSON.stringify({ error: "Invalid referral code" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if a referral already exists for this email
    const { data: existing } = await client
      .from("referrals")
      .select("id")
      .eq("referred_email", email.toLowerCase())
      .eq("referrer_user_id", codeRow.user_id)
      .maybeSingle();

    if (existing) {
      // Update the existing pending referral to signed_up
      await client
        .from("referrals")
        .update({ status: "signed_up" })
        .eq("id", existing.id)
        .eq("status", "pending");
    } else {
      // Create a new referral record
      await client.from("referrals").insert({
        referrer_user_id: codeRow.user_id,
        referred_email: email.toLowerCase(),
        status: "signed_up",
      });
    }

    return new Response(JSON.stringify({ linked: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[link-referral] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
