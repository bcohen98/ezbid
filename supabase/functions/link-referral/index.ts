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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Require an authenticated user — referrals must be tied to a real signup
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authedClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await authedClient.auth.getUser();
    if (userErr || !user || !user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { referralCode } = await req.json();
    if (!referralCode || typeof referralCode !== "string") {
      return new Response(JSON.stringify({ error: "Missing referralCode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the authenticated user's email — never trust client-supplied email
    const email = user.email.toLowerCase();
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

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

    // Don't allow self-referral
    if (codeRow.user_id === user.id) {
      return new Response(JSON.stringify({ error: "Cannot refer yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await client
      .from("referrals")
      .select("id")
      .eq("referred_email", email)
      .eq("referrer_user_id", codeRow.user_id)
      .maybeSingle();

    if (existing) {
      await client
        .from("referrals")
        .update({ status: "signed_up", referred_user_id: user.id })
        .eq("id", existing.id)
        .eq("status", "pending");
    } else {
      await client.from("referrals").insert({
        referrer_user_id: codeRow.user_id,
        referred_email: email,
        referred_user_id: user.id,
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
