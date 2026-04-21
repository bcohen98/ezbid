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
    const { data: isAdmin } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { email, initials, target_user_id, action } = await req.json();

    // action: 'create' | 'update_initials' | 'approve_payout' | 'remove'
    if (action === "approve_payout") {
      const { prospect_id } = await req.json().catch(() => ({}));
      // Re-parse: we already consumed body above. Workaround:
      return new Response(JSON.stringify({ error: "Use admin-approve-payout function" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let targetId = target_user_id as string | undefined;
    if (!targetId && email) {
      const { data: prof } = await admin.from("company_profiles").select("user_id").eq("email", String(email).trim().toLowerCase()).maybeSingle();
      if (!prof) return new Response(JSON.stringify({ error: "User not found by email" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      targetId = prof.user_id;
    }
    if (!targetId) return new Response(JSON.stringify({ error: "target_user_id or email required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (action === "remove") {
      await admin.from("user_roles").delete().eq("user_id", targetId).eq("role", "ambassador");
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_initials") {
      if (!initials) return new Response(JSON.stringify({ error: "initials required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await admin.from("ambassador_profiles").update({ initials: String(initials).toUpperCase().slice(0, 5) }).eq("user_id", targetId);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Default: create ambassador
    const cleanInitials = String(initials || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
    if (!cleanInitials) return new Response(JSON.stringify({ error: "Valid initials required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // upsert role
    const { data: existingRole } = await admin.from("user_roles").select("id").eq("user_id", targetId).eq("role", "ambassador").maybeSingle();
    if (!existingRole) {
      await admin.from("user_roles").insert({ user_id: targetId, role: "ambassador" });
    }
    // upsert ambassador_profiles
    const { data: existingProf } = await admin.from("ambassador_profiles").select("user_id").eq("user_id", targetId).maybeSingle();
    if (existingProf) {
      await admin.from("ambassador_profiles").update({ initials: cleanInitials }).eq("user_id", targetId);
    } else {
      await admin.from("ambassador_profiles").insert({ user_id: targetId, initials: cleanInitials });
    }
    return new Response(JSON.stringify({ success: true, user_id: targetId, initials: cleanInitials }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("admin-make-ambassador error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
