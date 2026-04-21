import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function randCode(len = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["ambassador", "admin"])
      .maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: ambProfile } = await admin
      .from("ambassador_profiles")
      .select("initials, total_codes_generated")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ambProfile?.initials) {
      return new Response(JSON.stringify({ error: "Ambassador profile or initials not set" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { prospect_name, prospect_phone, notes } = body || {};
    if (!prospect_name || typeof prospect_name !== "string") {
      return new Response(JSON.stringify({ error: "prospect_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let code = "";
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = `${ambProfile.initials.toUpperCase()}-${randCode(5)}`;
      const { data: existing } = await admin.from("ambassador_prospects").select("id").eq("code", candidate).maybeSingle();
      if (!existing) { code = candidate; break; }
    }
    if (!code) return new Response(JSON.stringify({ error: "Failed to generate unique code" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: inserted, error: insertErr } = await admin
      .from("ambassador_prospects")
      .insert({
        ambassador_id: user.id,
        prospect_name: prospect_name.trim(),
        prospect_phone: prospect_phone?.trim() || null,
        code,
        notes: notes?.trim() || null,
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    await admin
      .from("ambassador_profiles")
      .update({ total_codes_generated: (ambProfile.total_codes_generated || 0) + 1 })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ prospect: inserted }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ambassador-create-prospect error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
