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

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;

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
  const range = url.searchParams.get("range") || "month";

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
      result = await getAnalytics(adminClient, range);
    } else if (section === "visitor_analytics") {
      result = await getVisitorAnalytics(adminClient, range);
    } else if (section === "referrals") {
      result = await getReferrals(adminClient);
    } else if (section === "conversions") {
      result = await getConversions(adminClient, range);
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

  const { count: guestProposals } = await client
    .from("guest_proposals")
    .select("*", { count: "exact", head: true });

  return {
    totalUsers: totalUsers || 0,
    signupsThisWeek: signupsThisWeek || 0,
    signupsToday: signupsToday || 0,
    activeSubscribers: activeSubscribers || 0,
    mrr,
    totalProposals: totalProposals || 0,
    proposalsThisWeek: proposalsThisWeek || 0,
    guestProposals: guestProposals || 0,
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
    .select("user_id, status, proposals_used, updated_at, bonus_proposals");

  // Get actual proposal counts per user
  const { data: proposalCounts } = await client
    .from("proposals")
    .select("user_id");

  const proposalCountMap = new Map<string, number>();
  for (const p of proposalCounts || []) {
    proposalCountMap.set(p.user_id, (proposalCountMap.get(p.user_id) || 0) + 1);
  }

  const subMap = new Map(
    (subscriptions || []).map((s) => [s.user_id, s])
  );

  const users = (profiles || []).map((p) => {
    const sub = subMap.get(p.user_id);
    const isActive = sub?.status === "active";
    const proposalsUsed = sub?.proposals_used ?? 0;
    const bonusProposals = (sub as any)?.bonus_proposals ?? 0;
    const freeLimit = 3 + bonusProposals;
    const hitFreeLimit = !isActive && proposalsUsed >= freeLimit;
    const actualProposalCount = proposalCountMap.get(p.user_id) || 0;

    return {
      userId: p.user_id,
      email: p.email,
      signupDate: p.created_at,
      plan: isActive ? "Paid" : "Free",
      proposalsUsed,
      bonusProposals,
      freeLimit,
      actualProposalCount,
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

function getRangeConfig(range: string) {
  const now = new Date();
  let since: Date;
  let bucketCount: number;
  let bucketMs: number;
  let formatKey: (d: Date) => string;
  let formatLabel: string;

  switch (range) {
    case "hour": {
      since = new Date(now.getTime() - 60 * 60 * 1000);
      bucketCount = 12; // 5-min buckets
      bucketMs = 5 * 60 * 1000;
      formatKey = (d) => d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
      formatLabel = "HH:MM";
      break;
    }
    case "day": {
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      bucketCount = 24;
      bucketMs = 60 * 60 * 1000;
      formatKey = (d) => d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      formatLabel = "HH:00";
      break;
    }
    case "week": {
      since = new Date(now);
      since.setDate(now.getDate() - 7);
      bucketCount = 7;
      bucketMs = 24 * 60 * 60 * 1000;
      formatKey = (d) => d.toISOString().slice(0, 10);
      formatLabel = "MM-DD";
      break;
    }
    case "year": {
      since = new Date(now);
      since.setFullYear(now.getFullYear() - 1);
      bucketCount = 12;
      bucketMs = 30 * 24 * 60 * 60 * 1000; // approx month
      formatKey = (d) => d.toISOString().slice(0, 7); // YYYY-MM
      formatLabel = "YYYY-MM";
      break;
    }
    default: {
      // Custom range "YYYY-MM-DD_YYYY-MM-DD" or default to 30 days
      if (range.includes("_")) {
        const [startStr, endStr] = range.split("_");
        since = new Date(startStr);
        const endDate = new Date(endStr);
        endDate.setHours(23, 59, 59, 999);
        const diffMs = endDate.getTime() - since.getTime();
        const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
        bucketCount = Math.max(diffDays, 1);
        bucketMs = 24 * 60 * 60 * 1000;
        formatKey = (d) => d.toISOString().slice(0, 10);
        formatLabel = "MM-DD";
      } else {
        // month (30 days)
        since = new Date(now);
        since.setDate(now.getDate() - 30);
        bucketCount = 30;
        bucketMs = 24 * 60 * 60 * 1000;
        formatKey = (d) => d.toISOString().slice(0, 10);
        formatLabel = "MM-DD";
      }
      break;
    }
  }
  return { since, bucketCount, bucketMs, formatKey, formatLabel, now };
}

function buildBuckets(cfg: ReturnType<typeof getRangeConfig>) {
  const buckets: string[] = [];
  for (let i = cfg.bucketCount - 1; i >= 0; i--) {
    const d = new Date(cfg.now.getTime() - i * cfg.bucketMs);
    buckets.push(cfg.formatKey(d));
  }
  return buckets;
}

async function getAnalytics(client: ReturnType<typeof createClient>, range: string) {
  const cfg = getRangeConfig(range);
  const buckets = buildBuckets(cfg);

  const { data: pageViewsFull } = await client
    .from("page_views")
    .select("created_at, path, session_id")
    .gte("created_at", cfg.since.toISOString())
    .order("created_at", { ascending: true });

  const visitsByBucket: Record<string, { views: number; uniqueSessions: Set<string> }> = {};
  for (const pv of pageViewsFull || []) {
    const key = cfg.formatKey(new Date(pv.created_at));
    if (!visitsByBucket[key]) visitsByBucket[key] = { views: 0, uniqueSessions: new Set() };
    visitsByBucket[key].views++;
    if (pv.session_id) visitsByBucket[key].uniqueSessions.add(pv.session_id);
  }

  const dailyVisits = buckets.map((key) => ({
    date: key,
    pageViews: visitsByBucket[key]?.views || 0,
    visitors: visitsByBucket[key]?.uniqueSessions.size || 0,
  }));

  // Errors
  const { data: errors } = await client
    .from("app_errors")
    .select("created_at, error_message, path")
    .gte("created_at", cfg.since.toISOString())
    .order("created_at", { ascending: false });

  const errorsByBucket: Record<string, number> = {};
  for (const e of errors || []) {
    const key = cfg.formatKey(new Date(e.created_at));
    errorsByBucket[key] = (errorsByBucket[key] || 0) + 1;
  }

  const dailyErrors = buckets.map((key) => ({
    date: key,
    errors: errorsByBucket[key] || 0,
  }));

  const recentErrors = (errors || []).slice(0, 20).map((e) => ({
    message: e.error_message,
    path: e.path,
    timestamp: e.created_at,
  }));

  // Downtime: buckets with 0 views (only for day+ ranges)
  const downtimeDays = range !== "hour"
    ? dailyVisits.filter((d) => d.pageViews === 0).map((d) => d.date)
    : [];

  // Top pages
  const pageCounts: Record<string, number> = {};
  for (const pv of pageViewsFull || []) {
    pageCounts[pv.path] = (pageCounts[pv.path] || 0) + 1;
  }
  const topPages = Object.entries(pageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  const rangeLabel = range === "hour" ? "1h" : range === "day" ? "24h" : range === "week" ? "7d" : range === "year" ? "1y" : "30d";

  return {
    dailyVisits,
    dailyErrors,
    recentErrors,
    downtimeDays,
    topPages,
    totalViews30d: (pageViewsFull || []).length,
    totalErrors30d: (errors || []).length,
    rangeLabel,
  };
}

// ── Referrals ─────────────────────────────────────────────
async function getReferrals(client: ReturnType<typeof createClient>) {
  const { data: allReferrals } = await client
    .from("referrals")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: allCredits } = await client
    .from("referral_credits")
    .select("*");

  const { data: profiles } = await client
    .from("company_profiles")
    .select("user_id, email");

  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.email]));

  const referrals = (allReferrals || []).map((r) => ({
    ...r,
    referrer_email: profileMap.get(r.referrer_user_id) || "Unknown",
  }));

  const totalReferrals = referrals.length;
  const totalConverted = referrals.filter((r) => r.status === "converted").length;
  const totalCreditsIssued = (allCredits || []).length;
  const totalCreditsApplied = (allCredits || []).filter((c) => c.applied_at).length;

  // Top referrers
  const referrerCounts: Record<string, { totalReferrals: number; converted: number; email: string }> = {};
  for (const r of referrals) {
    if (!referrerCounts[r.referrer_user_id]) {
      referrerCounts[r.referrer_user_id] = {
        totalReferrals: 0,
        converted: 0,
        email: r.referrer_email,
      };
    }
    referrerCounts[r.referrer_user_id].totalReferrals++;
    if (r.status === "converted") referrerCounts[r.referrer_user_id].converted++;
  }

  const topReferrers = Object.values(referrerCounts)
    .sort((a, b) => b.converted - a.converted || b.totalReferrals - a.totalReferrals)
    .slice(0, 10);

  return {
    referrals,
    totalReferrals,
    totalConverted,
    totalCreditsIssued,
    totalCreditsApplied,
    topReferrers,
  };
}

// ── Shared range helper ───────────────────────────────────
function rangeToSince(range: string): Date {
  const now = new Date();
  switch (range) {
    case "hour": return new Date(now.getTime() - 60 * 60 * 1000);
    case "day": return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "week": { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    case "month": { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
    case "year": { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d; }
    // Legacy numeric values
    case "7": { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    case "30": { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
    case "90": { const d = new Date(now); d.setDate(d.getDate() - 90); return d; }
    default: {
      // Custom range: "YYYY-MM-DD_YYYY-MM-DD"
      if (range.includes("_")) {
        const [start] = range.split("_");
        return new Date(start);
      }
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }
}

function rangeToEnd(range: string): Date | null {
  if (range.includes("_")) {
    const [, end] = range.split("_");
    const d = new Date(end);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  return null;
}

// ── Visitor Analytics (site_analytics table) ──────────────
async function getVisitorAnalytics(client: ReturnType<typeof createClient>, range: string) {
  const now = new Date();
  const since = rangeToSince(range);
  const end = rangeToEnd(range);

  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Fetch all analytics in range
  let analyticsQuery = client
    .from("site_analytics")
    .select("ip_address, page_url, session_id, visitor_id, is_logged_in, user_id, is_guest_proposal_start, is_guest_proposal_complete, visited_at")
    .gte("visited_at", since.toISOString());
  if (end) analyticsQuery = analyticsQuery.lte("visited_at", end.toISOString());
  const { data: analytics } = await analyticsQuery
    .order("visited_at", { ascending: true });

  const rows = analytics || [];

  // All-time stats
  const { data: allTimeRows } = await client
    .from("site_analytics")
    .select("ip_address, visitor_id")
    .limit(10000);
  const allTimeUniqueIPs = new Set((allTimeRows || []).map(r => r.ip_address));

  // 30-day stats
  const { data: last30dRows } = await client
    .from("site_analytics")
    .select("ip_address, visitor_id, is_guest_proposal_complete")
    .gte("visited_at", since30d.toISOString());

  const uniqueIPs30d = new Set((last30dRows || []).map(r => r.ip_address));
  const totalVisits30d = (last30dRows || []).length;
  const guestProposals30d = (last30dRows || []).filter(r => r.is_guest_proposal_complete).length;

  // Daily chart data
  const dayBuckets: Record<string, { totalVisits: number; uniqueIPs: Set<string>; uniqueVisitors: Set<string>; guestVisits: number; loggedInVisits: number; newVisitors: Set<string>; returningVisitors: Set<string> }> = {};
  const seenVisitorIds = new Set<string>();

  for (const row of rows) {
    const day = row.visited_at.slice(0, 10);
    if (!dayBuckets[day]) {
      dayBuckets[day] = {
        totalVisits: 0,
        uniqueIPs: new Set(),
        uniqueVisitors: new Set(),
        guestVisits: 0,
        loggedInVisits: 0,
        newVisitors: new Set(),
        returningVisitors: new Set(),
      };
    }
    const b = dayBuckets[day];
    b.totalVisits++;
    b.uniqueIPs.add(row.ip_address);

    const vid = row.visitor_id || row.ip_address;
    b.uniqueVisitors.add(vid);

    if (row.is_logged_in) {
      b.loggedInVisits++;
    } else {
      b.guestVisits++;
    }

    if (seenVisitorIds.has(vid)) {
      b.returningVisitors.add(vid);
    } else {
      b.newVisitors.add(vid);
      seenVisitorIds.add(vid);
    }
  }

  // Build sorted daily array
  const days = Object.keys(dayBuckets).sort();
  const dailyData = days.map(day => ({
    date: day,
    totalVisits: dayBuckets[day].totalVisits,
    uniqueVisitors: dayBuckets[day].uniqueVisitors.size,
    guestVisits: dayBuckets[day].guestVisits,
    loggedInVisits: dayBuckets[day].loggedInVisits,
    newVisitors: dayBuckets[day].newVisitors.size,
    returningVisitors: dayBuckets[day].returningVisitors.size,
  }));

  // Funnel data (in selected range)
  const uniqueVisitorsInRange = new Set(rows.map(r => r.visitor_id || r.ip_address));
  const startedGuestProposal = new Set(
    rows.filter(r => r.is_guest_proposal_start).map(r => r.visitor_id || r.ip_address)
  );
  const completedGuestProposal = new Set(
    rows.filter(r => r.is_guest_proposal_complete).map(r => r.visitor_id || r.ip_address)
  );

  // Account creation: count unique user_ids that appear in range
  const createdAccounts = new Set(
    rows.filter(r => r.user_id).map(r => r.user_id)
  );

  // Paid subscribers: check user_subscriptions for active status
  let paidCount = 0;
  if (createdAccounts.size > 0) {
    const userIds = Array.from(createdAccounts).filter(Boolean);
    if (userIds.length > 0) {
      const { data: subs } = await client
        .from("user_subscriptions")
        .select("user_id, status")
        .in("user_id", userIds as string[])
        .eq("status", "active");
      paidCount = (subs || []).length;
    }
  }

  return {
    summary: {
      uniqueVisitorsAllTime: allTimeUniqueIPs.size,
      uniqueVisitors30d: uniqueIPs30d.size,
      totalVisits30d,
      guestProposals30d,
    },
    dailyData,
    funnel: {
      uniqueVisitors: uniqueVisitorsInRange.size,
      startedGuestProposal: startedGuestProposal.size,
      completedGuestProposal: completedGuestProposal.size,
      createdAccount: createdAccounts.size,
      upgradedToPaid: paidCount,
    },
  };
}

// ── Conversions (conversion_events table) ─────────────────
async function getConversions(client: ReturnType<typeof createClient>, range: string) {
  const since = rangeToSince(range);
  const end = rangeToEnd(range);

  let query = client
    .from("conversion_events")
    .select("event_name, created_at, session_id, visitor_id, metadata, page_path")
    .gte("created_at", since.toISOString());
  if (end) query = query.lte("created_at", end.toISOString());
  const { data: events } = await query
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = events || [];

  // Summary counts by event name
  const eventCounts: Record<string, number> = {};
  for (const e of rows) {
    eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1;
  }

  // Daily breakdown
  const dayBuckets: Record<string, Record<string, number>> = {};
  for (const e of rows) {
    const day = e.created_at.slice(0, 10);
    if (!dayBuckets[day]) dayBuckets[day] = {};
    dayBuckets[day][e.event_name] = (dayBuckets[day][e.event_name] || 0) + 1;
  }

  const days = Object.keys(dayBuckets).sort();
  const allEventNames = [...new Set(rows.map(r => r.event_name))];

  const dailyData = days.map(day => ({
    date: day,
    ...Object.fromEntries(allEventNames.map(name => [name, dayBuckets[day][name] || 0])),
  }));

  // Recent events feed (latest 50)
  const recentEvents = rows.slice(0, 50).map(e => ({
    event_name: e.event_name,
    created_at: e.created_at,
    page_path: e.page_path,
    visitor_id: e.visitor_id,
    metadata: e.metadata,
  }));

  return {
    eventCounts,
    dailyData,
    allEventNames,
    recentEvents,
    totalEvents: rows.length,
  };
}
