import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const results: string[] = [];

    // ─── EMAIL 2: Day-1 nudge ───
    // Users who signed up 24–48h ago with 0 proposals and haven't received day1_nudge
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: nudgeCandidates } = await supabase
      .from("user_subscriptions")
      .select("user_id, created_at, proposals_used")
      .eq("proposals_used", 0)
      .lte("created_at", oneDayAgo)
      .gte("created_at", twoDaysAgo);

    if (nudgeCandidates && nudgeCandidates.length > 0) {
      // Filter out those already sent
      const { data: alreadySent } = await supabase
        .from("lifecycle_email_logs")
        .select("user_id")
        .eq("email_type", "day1_nudge")
        .in("user_id", nudgeCandidates.map((u) => u.user_id));

      const sentIds = new Set((alreadySent || []).map((r) => r.user_id));

      // Filter out unsubscribed
      const { data: unsubs } = await supabase
        .from("lifecycle_email_unsubs")
        .select("user_id")
        .in("user_id", nudgeCandidates.map((u) => u.user_id));
      const unsubIds = new Set((unsubs || []).map((r) => r.user_id));

      for (const user of nudgeCandidates) {
        if (sentIds.has(user.user_id) || unsubIds.has(user.user_id)) continue;

        // Get user email + name
        const { data: profile } = await supabase
          .from("company_profiles")
          .select("email, owner_name")
          .eq("user_id", user.user_id)
          .single();

        if (!profile?.email) continue;

        await supabase.functions.invoke("send-lifecycle-email", {
          body: {
            email_type: "day1_nudge",
            user_id: user.user_id,
            recipient_email: profile.email,
            first_name: profile.owner_name,
          },
        });
        results.push(`day1_nudge → ${profile.email}`);
      }
    }

    // ─── EMAIL 3 (cron catch-up): Free limit hit for existing users ───
    // Find free-tier users who have used 3+ proposals but never got the email
    const { data: freeLimitCandidates } = await supabase
      .from("user_subscriptions")
      .select("user_id, proposals_used")
      .neq("status", "active")
      .gte("proposals_used", 3);

    if (freeLimitCandidates && freeLimitCandidates.length > 0) {
      const { data: alreadySentLimit } = await supabase
        .from("lifecycle_email_logs")
        .select("user_id")
        .eq("email_type", "free_limit")
        .in("user_id", freeLimitCandidates.map((u) => u.user_id));
      const sentLimitIds = new Set((alreadySentLimit || []).map((r) => r.user_id));

      const { data: unsubsLimit } = await supabase
        .from("lifecycle_email_unsubs")
        .select("user_id")
        .in("user_id", freeLimitCandidates.map((u) => u.user_id));
      const unsubLimitIds = new Set((unsubsLimit || []).map((r) => r.user_id));

      for (const user of freeLimitCandidates) {
        if (sentLimitIds.has(user.user_id) || unsubLimitIds.has(user.user_id)) continue;

        const { data: profile } = await supabase
          .from("company_profiles")
          .select("email, owner_name")
          .eq("user_id", user.user_id)
          .single();

        if (!profile?.email) continue;

        await supabase.functions.invoke("send-lifecycle-email", {
          body: {
            email_type: "free_limit",
            user_id: user.user_id,
            recipient_email: profile.email,
            first_name: profile.owner_name,
          },
        });
        results.push(`free_limit → ${profile.email}`);
      }
    }

    // ─── EMAIL 4: Day-10 inactive paid subscriber ───
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    // Get paid subscribers
    const { data: paidUsers } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("status", "active");

    if (paidUsers && paidUsers.length > 0) {
      // Filter out already sent
      const { data: alreadySent } = await supabase
        .from("lifecycle_email_logs")
        .select("user_id")
        .eq("email_type", "day10_inactive")
        .in("user_id", paidUsers.map((u) => u.user_id));
      const sentIds = new Set((alreadySent || []).map((r) => r.user_id));

      // Filter out unsubscribed
      const { data: unsubs } = await supabase
        .from("lifecycle_email_unsubs")
        .select("user_id")
        .in("user_id", paidUsers.map((u) => u.user_id));
      const unsubIds = new Set((unsubs || []).map((r) => r.user_id));

      for (const user of paidUsers) {
        if (sentIds.has(user.user_id) || unsubIds.has(user.user_id)) continue;

        // Check last activity via page_views
        const { data: recentView } = await supabase
          .from("page_views")
          .select("created_at")
          .eq("user_id", user.user_id)
          .order("created_at", { ascending: false })
          .limit(1);

        // If they have a recent page view within 10 days, skip
        if (recentView && recentView.length > 0) {
          const lastSeen = new Date(recentView[0].created_at);
          if (lastSeen > new Date(tenDaysAgo)) continue;
        }

        // Get profile
        const { data: profile } = await supabase
          .from("company_profiles")
          .select("email, owner_name")
          .eq("user_id", user.user_id)
          .single();

        if (!profile?.email) continue;

        await supabase.functions.invoke("send-lifecycle-email", {
          body: {
            email_type: "day10_inactive",
            user_id: user.user_id,
            recipient_email: profile.email,
            first_name: profile.owner_name,
          },
        });
        results.push(`day10_inactive → ${profile.email}`);
      }
    }

    console.log(`[check-lifecycle-emails] Processed: ${results.length} emails`, results);
    return new Response(
      JSON.stringify({ sent: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[check-lifecycle-emails] ERROR:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
