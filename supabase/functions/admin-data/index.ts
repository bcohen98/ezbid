import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const section = url.searchParams.get("section") || "overview";

  try {
    let result: unknown;

    if (section === "check") {
      result = { is_admin: true };
    } else if (section === "overview") {
      result = await getOverview(adminClient);
    } else if (section === "users") {
      result = await getUsers(adminClient);
    } else if (section === "proposals") {
      result = await getProposals(adminClient);
    } else if (section === "revenue") {
      result = await getRevenue(adminClient);
    } else if (section === "analytics") {
      result = await getAnalytics(adminClient);
    } else {
      return new Response(JSON.stringify({ error: "Invalid section" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Admin data error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ── Overview ──────────────────────────────────────────────
async function getOverview(client: ReturnType<typeof createClient>) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const { count: totalUsers } = await client
    .from("company_profiles")
    .select("*", { count: "exact", head: true });

  const { count: signupsThisWeek } = await client
    .from("company_profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfWeek.toISOString());

  const { count: signupsToday } = await client
    .from("company_profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfToday.toISOString());

  const { count: activeSubscribers } = await client
    .from("user_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const mrr = (activeSubscribers || 0) * 39;

  const { count: totalProposals } = await client
    .from("proposals")
    .select("*", { count: "exact", head: true });

  const { count: proposalsThisWeek } = await client
    .from("proposals")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfWeek.toISOString());

  const { data: allProposals } = await client
    .from("proposals")
    .select("status");

  const statusCounts: Record<string, number> = {};
  for (const p of allProposals || []) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  }

  return {
    totalUsers: totalUsers || 0,
    signupsThisWeek: signupsThisWeek || 0,
    signupsToday: signupsToday || 0,
    activeSubscribers: activeSubscribers || 0,
    mrr,
    totalProposals: totalProposals || 0,
    proposalsThisWeek: proposalsThisWeek || 0,
    statusCounts,
  };
}

// ── Users ─────────────────────────────────────────────────
async function getUsers(client: ReturnType<typeof createClient>) {
  const { data: profiles } = await client
    .from("company_profiles")
    .select("user_id, email, created_at, trade_type")
    .order("created_at", { ascending: false });

  const { data: subscriptions } = await client
    .from("user_subscriptions")
    .select("user_id, status, proposals_used, updated_at");

  const subMap = new Map(
    (subscriptions || []).map((s) => [s.user_id, s])
  );

  const users = (profiles || []).map((p) => {
    const sub = subMap.get(p.user_id);
    const isActive = sub?.status === "active";
    const proposalsUsed = sub?.proposals_used ?? 0;
    const hitFreeLimit = !isActive && proposalsUsed >= 3;

    return {
      email: p.email,
      signupDate: p.created_at,
      plan: isActive ? "Paid" : "Free",
      proposalsUsed,
      lastActive: sub?.updated_at || p.created_at,
      status: isActive ? "Subscriber" : hitFreeLimit ? "Hit free limit" : "Active",
      hitFreeLimit,
    };
  });

  return { users };
}

// ── Proposals ─────────────────────────────────────────────
async function getProposals(client: ReturnType<typeof createClient>) {
  const { data: proposals } = await client
    .from("proposals")
    .select("id, proposal_number, user_id, client_name, total, status, created_at")
    .order("created_at", { ascending: false });

  const { data: profiles } = await client
    .from("company_profiles")
    .select("user_id, email, trade_type");

  const profileMap = new Map(
    (profiles || []).map((p) => [p.user_id, p])
  );

  const items = (proposals || []).map((p) => {
    const profile = profileMap.get(p.user_id);
    return {
      proposalNumber: p.proposal_number,
      contractorEmail: profile?.email || "Unknown",
      clientName: p.client_name || "No client",
      tradeType: profile?.trade_type || "other",
      total: p.total || 0,
      status: p.status,
      createdAt: p.created_at,
    };
  });

  return { proposals: items };
}

// ── Revenue ───────────────────────────────────────────────
async function getRevenue(client: ReturnType<typeof createClient>) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: allSubs } = await client
    .from("user_subscriptions")
    .select("status, created_at, updated_at, stripe_subscription_id");

  const activeSubs = (allSubs || []).filter((s) => s.status === "active");
  const mrr = activeSubs.length * 39;

  const newThisMonth = activeSubs.filter(
    (s) => new Date(s.created_at) >= startOfMonth
  ).length;

  const cancellationsThisMonth = (allSubs || []).filter(
    (s) =>
      (s.status === "canceled" || s.status === "cancelled") &&
      new Date(s.updated_at) >= startOfMonth
  ).length;

  return {
    activeSubscribers: activeSubs.length,
    mrr,
    newSubscribersThisMonth: newThisMonth,
    cancellationsThisMonth,
  };
}

// ── Analytics (site visits, errors, downtime) ─────────────
async function getAnalytics(client: ReturnType<typeof createClient>) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Page views per day (last 30 days)
  const { data: pageViews } = await client
    .from("page_views")
    .select("created_at, path")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  // Aggregate by day
  const visitsByDay: Record<string, { views: number; uniqueSessions: Set<string> }> = {};
  // We need session_id for unique counts, re-query with it
  const { data: pageViewsFull } = await client
    .from("page_views")
    .select("created_at, path, session_id")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  for (const pv of pageViewsFull || []) {
    const day = pv.created_at.slice(0, 10);
    if (!visitsByDay[day]) {
      visitsByDay[day] = { views: 0, uniqueSessions: new Set() };
    }
    visitsByDay[day].views++;
    if (pv.session_id) visitsByDay[day].uniqueSessions.add(pv.session_id);
  }

  // Build daily array for last 30 days
  const dailyVisits = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = visitsByDay[key];
    dailyVisits.push({
      date: key,
      pageViews: entry?.views || 0,
      visitors: entry?.uniqueSessions.size || 0,
    });
  }

  // App errors per day
  const { data: errors } = await client
    .from("app_errors")
    .select("created_at, error_message, path")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  const errorsByDay: Record<string, number> = {};
  for (const e of errors || []) {
    const day = e.created_at.slice(0, 10);
    errorsByDay[day] = (errorsByDay[day] || 0) + 1;
  }

  const dailyErrors = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyErrors.push({ date: key, errors: errorsByDay[key] || 0 });
  }

  // Recent errors list (last 20)
  const recentErrors = (errors || []).slice(0, 20).map((e) => ({
    message: e.error_message,
    path: e.path,
    timestamp: e.created_at,
  }));

  // Downtime detection: days with zero page views (among days that should have traffic)
  // Simple heuristic: flag days with 0 views in last 14 days as potential downtime
  const downtimeDays = dailyVisits
    .slice(-14)
    .filter((d) => d.pageViews === 0)
    .map((d) => d.date);

  // Top pages
  const pageCounts: Record<string, number> = {};
  for (const pv of pageViewsFull || []) {
    pageCounts[pv.path] = (pageCounts[pv.path] || 0) + 1;
  }
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  return {
    dailyVisits,
    dailyErrors,
    recentErrors,
    downtimeDays,
    topPages,
    totalViews30d: (pageViewsFull || []).length,
    totalErrors30d: (errors || []).length,
  };
}
