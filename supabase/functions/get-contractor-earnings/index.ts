// Requires: none (uses Supabase service role)
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, supabaseAnon);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Fetch all succeeded transactions
    const { data: txns } = await adminClient
      .from("payment_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "succeeded")
      .order("created_at", { ascending: false });

    const all = txns || [];
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const sum = (arr: any[], field: string) => arr.reduce((s, t) => s + (Number(t[field]) || 0), 0);

    const thisMonth = all.filter(t => new Date(t.created_at) >= thisMonthStart);
    const lastMonth = all.filter(t => {
      const d = new Date(t.created_at);
      return d >= lastMonthStart && d <= lastMonthEnd;
    });
    const thisYear = all.filter(t => new Date(t.created_at) >= yearStart);

    // By month (last 12)
    const byMonth: { month: string; amount: number; fees: number; net: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const inMonth = all.filter(t => {
        const td = new Date(t.created_at);
        return td >= d && td <= end;
      });
      byMonth.push({
        month: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
        amount: sum(inMonth, "amount"),
        fees: sum(inMonth, "stripe_fee") + sum(inMonth, "platform_fee"),
        net: sum(inMonth, "net_amount"),
      });
    }

    // Pending amounts
    const { data: pendingProposals } = await adminClient
      .from("proposals")
      .select("total, deposit_amount, deposit_paid_amount, payment_status")
      .eq("user_id", user.id)
      .in("payment_status", ["deposit_requested", "payment_requested"]);

    const pendingAmount = (pendingProposals || []).reduce((s, p) => {
      if (p.payment_status === "deposit_requested") return s + (Number(p.deposit_amount) || 0);
      if (p.payment_status === "payment_requested") {
        const depositPaid = Number(p.deposit_paid_amount) || 0;
        return s + ((Number(p.total) || 0) - depositPaid);
      }
      return s;
    }, 0);

    // Recent transactions (last 10 including pending)
    const { data: recentAll } = await adminClient
      .from("payment_transactions")
      .select("*, proposals!inner(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const recentTransactions = (recentAll || []).map(t => ({
      id: t.id,
      date: t.created_at,
      proposal_title: (t as any).proposals?.title || "Untitled",
      client_name: t.client_name,
      amount: t.amount,
      stripe_fee: t.stripe_fee,
      platform_fee: t.platform_fee,
      net_amount: t.net_amount,
      status: t.status,
      type: t.type,
      proposal_id: t.proposal_id,
    }));

    return new Response(JSON.stringify({
      total_collected: sum(all, "amount"),
      total_stripe_fees: sum(all, "stripe_fee"),
      total_platform_fees: sum(all, "platform_fee"),
      total_net: sum(all, "net_amount"),
      this_month: { collected: sum(thisMonth, "amount"), net: sum(thisMonth, "net_amount") },
      last_month: { collected: sum(lastMonth, "amount"), net: sum(lastMonth, "net_amount") },
      this_year: { collected: sum(thisYear, "amount"), net: sum(thisYear, "net_amount") },
      by_month: byMonth,
      recent_transactions: recentTransactions,
      pending_amount: pendingAmount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[get-contractor-earnings]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
