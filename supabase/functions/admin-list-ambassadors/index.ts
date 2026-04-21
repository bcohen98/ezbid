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

    // get all ambassador_profiles
    const { data: profiles } = await admin.from("ambassador_profiles").select("*");
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ ambassadors: [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userIds = profiles.map((p: any) => p.user_id);
    const { data: companies } = await admin.from("company_profiles").select("user_id, email, owner_name, company_name").in("user_id", userIds);
    const companyMap = new Map((companies || []).map((c: any) => [c.user_id, c]));

    // counts per ambassador
    const { data: prospects } = await admin.from("ambassador_prospects").select("ambassador_id, used, payout_approved");
    const stats = new Map<string, { codes: number; conversions: number; approved: number; pending: number }>();
    for (const p of prospects || []) {
      const s = stats.get(p.ambassador_id) || { codes: 0, conversions: 0, approved: 0, pending: 0 };
      s.codes += 1;
      if (p.used) s.conversions += 1;
      if (p.payout_approved) s.approved += 1;
      else if (p.used) s.pending += 1;
      stats.set(p.ambassador_id, s);
    }

    const ambassadors = profiles.map((p: any) => {
      const c = companyMap.get(p.user_id);
      const s = stats.get(p.user_id) || { codes: 0, conversions: 0, approved: 0, pending: 0 };
      return {
        user_id: p.user_id,
        initials: p.initials,
        email: c?.email,
        name: c?.owner_name || c?.company_name || c?.email,
        codes_generated: s.codes,
        conversions: s.conversions,
        approved_payouts: s.approved,
        pending_payouts: s.pending,
      };
    });

    return new Response(JSON.stringify({ ambassadors }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("admin-list-ambassadors error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
