import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ambassador OR admin
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).in("role", ["ambassador", "admin"]).maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { recipient_email, amount } = await req.json();
    if (!recipient_email || !amount || amount < 1 || amount > 3) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // find recipient by email via company_profiles (which has email column)
    const { data: recipient } = await admin.from("company_profiles").select("user_id, email, owner_name").eq("email", recipient_email.trim().toLowerCase()).maybeSingle();
    if (!recipient) return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // enforce 3-grant cap per recipient across all ambassador grants
    const { data: existing } = await admin.from("ambassador_grants").select("amount").eq("recipient_user_id", recipient.user_id);
    const already = (existing || []).reduce((s: number, r: any) => s + (r.amount || 0), 0);
    if (already + amount > 3) {
      return new Response(JSON.stringify({ error: `User has already received ${already}/3 ambassador-granted proposals` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // log grant
    await admin.from("ambassador_grants").insert({ ambassador_id: user.id, recipient_user_id: recipient.user_id, amount });

    // bump bonus_proposals
    const { data: sub } = await admin.from("user_subscriptions").select("bonus_proposals").eq("user_id", recipient.user_id).single();
    await admin.from("user_subscriptions").update({ bonus_proposals: (sub?.bonus_proposals || 0) + amount }).eq("user_id", recipient.user_id);

    return new Response(JSON.stringify({ success: true, granted: amount, total_already: already + amount }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ambassador-grant-proposals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
