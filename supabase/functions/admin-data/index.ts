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

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  // Authenticate user with anon client
  const anonClient = createClient(supabaseUrl, anonKey);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await anonClient.auth.getUser(token);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check admin role using service role client
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse section from request
  const url = new URL(req.url);
  const section = url.searchParams.get("section") || "overview";

  try {
    let result: unknown;

    if (section === "check") {
      // Just checking admin status
      result = { is_admin: true };
    } else if (section === "overview") {
      result = await getOverview(adminClient);
    } else if (section === "users") {
      result = await getUsers(adminClient);
    } else if (section === "proposals") {
      result = await getProposals(adminClient);
    } else if (section === "revenue") {
      result = await getRevenue(adminClient);
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

async function getOverview(client: ReturnType<typeof createClient>) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Total users
  const { count: totalUsers } = await client
    .from("company_profiles")
    .select("*", { count: "exact", head: true });

  // Signups this week
  const { count: signupsThisWeek } = await client
    .from("company_profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfWeek.toISOString());

  // Signups today
  const { count: signupsToday } = await client
    .from("company_profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfToday.toISOString());

  // Active paid subscribers
  const { count: activeSubscribers } = await client
    .from("user_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  // MRR
  const mrr = (activeSubscribers || 0) * 39;

  // Total proposals
  const { count: totalProposals } = await client
    .from("proposals")
    .select("*", { count: "exact", head: true });

  // Proposals this week
  const { count: proposalsThisWeek } = await client
    .from("proposals")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfWeek.toISOString());

  // Proposals by status
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

async function getUsers(client: ReturnType<typeof createClient>) {
  // Get all profiles
  const { data: profiles } = await client
    .from("company_profiles")
    .select("user_id, email, created_at, trade_type")
    .order("created_at", { ascending: false });

  // Get all subscriptions
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

async function getProposals(client: ReturnType<typeof createClient>) {
  const { data: proposals } = await client
    .from("proposals")
    .select("id, proposal_number, user_id, client_name, total, status, created_at")
    .order("created_at", { ascending: false });

  // Get emails and trade types
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

async function getRevenue(client: ReturnType<typeof createClient>) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: allSubs } = await client
    .from("user_subscriptions")
    .select("status, created_at, updated_at, stripe_subscription_id");

  const activeSubs = (allSubs || []).filter((s) => s.status === "active");
  const mrr = activeSubs.length * 39;

  // New subscribers this month (active + created this month)
  const newThisMonth = activeSubs.filter(
    (s) => new Date(s.created_at) >= startOfMonth
  ).length;

  // Cancellations this month (status = canceled/cancelled and updated this month)
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
