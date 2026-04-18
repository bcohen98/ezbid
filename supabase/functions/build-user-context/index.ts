import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Helpers ───
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

const MATERIAL_KEYWORDS = ["material","supply","supplies","lumber","concrete","shingle","tile","paint","flooring","pipe","wire","drywall","insulation","fixture","equipment","asphalt","gravel","sand","plywood","adhesive","sealant","hardware","bolt","screw","nail","bracket","flashing","membrane"];
const LABOR_KEYWORDS = ["labor","install","installation","hrs","hours","work","crew"];
const isMaterial = (d: string) => { const x = (d||"").toLowerCase(); return MATERIAL_KEYWORDS.some(k => x.includes(k)); };
const isLabor = (d: string) => { const x = (d||"").toLowerCase(); return LABOR_KEYWORDS.some(k => x.includes(k)); };
const WIN_STATUSES = new Set(["signed","accepted","work_pending","payment_pending","closed"]);

// Background AI synthesis (fire-and-forget) — writes profile back to cache
async function synthesizeIntelligenceBackground(
  supabaseAdmin: any,
  contextUserId: string,
  trade: string,
  job_description: string,
  job_address: string,
  computedStats: any,
  proposalCount: number,
  cached: any,
) {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert construction industry analyst. Synthesize stats into a structured profile. Be precise. Return only valid JSON via the tool." },
          { role: "user", content: `Stats:\n\n${JSON.stringify(computedStats, null, 2)}\n\nJob: trade=${trade}, desc=${job_description||"n/a"}, loc=${job_address||"n/a"}.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_user_intelligence",
            description: "Return the synthesized intelligence profile",
            parameters: {
              type: "object",
              properties: {
                pricing_personality: { type: "string", enum: ["budget_friendly","mid_market","premium","variable"] },
                pricing_confidence: { type: "string", enum: ["high","medium","low"] },
                signature_line_items: { type: "array", items: { type: "object", properties: { description: { type: "string" }, suggested_quantity: { type: "number" }, suggested_unit: { type: "string" }, suggested_unit_price: { type: "number" }, confidence: { type: "string", enum: ["high","medium","low"] }, reason: { type: "string" } } } },
                pricing_benchmarks: { type: "array", items: { type: "object", properties: { line_item_type: { type: "string" }, learned_unit_price: { type: "number" }, learned_unit: { type: "string" }, price_range_low: { type: "number" }, price_range_high: { type: "number" }, based_on_n_proposals: { type: "number" }, confidence: { type: "string", enum: ["high","medium","low"] } } } },
                smart_defaults: { type: "object", properties: { suggested_tax_rate: { type: "number" }, suggested_deposit_pct: { type: "number" }, suggested_payment_terms: { type: "string" }, suggested_warranty_terms: { type: "string" }, suggested_deposit_mode: { type: "string", enum: ["percentage","flat"] } } },
                job_size_estimate: { type: "object", properties: { estimated_total_low: { type: "number" }, estimated_total_mid: { type: "number" }, estimated_total_high: { type: "number" }, estimated_line_item_count: { type: "number" }, sizing_rationale: { type: "string" } } },
                clarifying_question_priorities: { type: "array", items: { type: "string" } },
                contractor_insights: { type: "array", items: { type: "string" } },
                anomaly_flags: { type: "array", items: { type: "string" } },
              },
              required: ["pricing_personality","pricing_confidence","signature_line_items","pricing_benchmarks","smart_defaults","job_size_estimate","clarifying_question_priorities","contractor_insights"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_user_intelligence" } },
      }),
    });

    if (!aiResponse.ok) return;
    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return;
    const intelligenceProfile = typeof toolCall.function.arguments === "string"
      ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;

    if (cached) {
      await supabaseAdmin.from("user_intelligence_cache").update({
        trade_type: trade,
        computed_stats: computedStats,
        intelligence_profile: intelligenceProfile,
        proposal_count_at_computation: proposalCount,
        updated_at: new Date().toISOString(),
      }).eq("user_id", contextUserId);
    } else {
      await supabaseAdmin.from("user_intelligence_cache").insert({
        user_id: contextUserId,
        trade_type: trade,
        computed_stats: computedStats,
        intelligence_profile: intelligenceProfile,
        proposal_count_at_computation: proposalCount,
      });
    }
  } catch (e) {
    console.error("[bg synthesis] failed:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { trade, job_description, job_address, target_user_id, force_refresh } = body || {};

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    let contextUserId = user.id;
    if (target_user_id && target_user_id !== user.id) {
      const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      contextUserId = target_user_id;
    }

    // Fetch a small recent slice of proposals — keep CPU bounded
    const [proposalsRes, profileRes] = await Promise.all([
      supabaseAdmin.from("proposals")
        .select("id, trade_type, total, subtotal, tax_rate, deposit_value, deposit_mode, payment_terms, warranty_terms, created_at, status, job_site_state, job_site_city")
        .eq("user_id", contextUserId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabaseAdmin.from("company_profiles").select("trade_type, city, state, company_name, owner_name").eq("user_id", contextUserId).maybeSingle(),
    ]);

    const proposals = proposalsRes.data || [];
    if (proposals.length < 3) {
      return new Response(JSON.stringify({
        has_sufficient_history: false,
        message: "Insufficient proposal history for personalized intelligence",
        user_context: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cache — use maybeSingle so absence doesn't throw
    const { data: cached } = await supabaseAdmin
      .from("user_intelligence_cache")
      .select("*")
      .eq("user_id", contextUserId)
      .maybeSingle();

    if (!force_refresh && cached && cached.proposal_count_at_computation === proposals.length && cached.intelligence_profile) {
      return new Response(JSON.stringify({
        has_sufficient_history: true,
        proposal_count: proposals.length,
        computed_stats: cached.computed_stats,
        intelligence_profile: cached.intelligence_profile,
        cache_hit: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cap line items hard
    const proposalIds = proposals.map((p: any) => p.id);
    const { data: allLineItems } = await supabaseAdmin
      .from("proposal_line_items")
      .select("proposal_id, description, quantity, unit, unit_price, subtotal")
      .in("proposal_id", proposalIds)
      .limit(500);

    const lineItemsByProposal = new Map<string, any[]>();
    for (const li of (allLineItems || [])) {
      const arr = lineItemsByProposal.get(li.proposal_id) || [];
      arr.push(li);
      lineItemsByProposal.set(li.proposal_id, arr);
    }

    const currentTradeProposals = proposals.filter((p: any) => p.trade_type === trade);
    const tradeProposals = (currentTradeProposals.length >= 3 ? currentTradeProposals : proposals).slice(0, 30);

    const totals = tradeProposals.map((p: any) => Number(p.total) || 0).filter((t: number) => t > 0);
    const avgTotal = totals.length ? totals.reduce((a: number, b: number) => a + b, 0) / totals.length : 0;

    const allTradeItems = tradeProposals.flatMap((p: any) => lineItemsByProposal.get(p.id) || []).slice(0, 300);
    const totalItems = allTradeItems.length || 1;
    const itemGroups = new Map<string, any[]>();
    for (const li of allTradeItems) {
      const key = String(li.description || "").toLowerCase().trim().replace(/\s+/g, " ").slice(0, 60);
      if (!key) continue;
      const arr = itemGroups.get(key) || [];
      arr.push(li);
      itemGroups.set(key, arr);
    }

    const commonLineItems = [...itemGroups.entries()]
      .map(([_key, items]) => {
        const prices = items.map((li: any) => Number(li.unit_price) || 0);
        const quantities = items.map((li: any) => Number(li.quantity) || 0);
        const unitCounts = new Map<string, number>();
        for (const li of items) {
          const u = li.unit || "ea";
          unitCounts.set(u, (unitCounts.get(u) || 0) + 1);
        }
        const modeUnit = [...unitCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "ea";
        return {
          description: items[0]?.description || _key,
          frequency_pct: Math.round((items.length / totalItems) * 100),
          avg_quantity: quantities.length ? quantities.reduce((a: number, b: number) => a + b, 0) / quantities.length : 0,
          avg_unit: modeUnit,
          avg_unit_price: prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : 0,
          min_unit_price: prices.length ? Math.min(...prices) : 0,
          max_unit_price: prices.length ? Math.max(...prices) : 0,
          std_dev_unit_price: stdDev(prices),
        };
      })
      .sort((a, b) => b.frequency_pct - a.frequency_pct)
      .slice(0, 10);

    const laborItems = allTradeItems.filter((li: any) => isLabor(li.description));
    const avgLaborRate = laborItems.length ? laborItems.reduce((s: number, li: any) => s + (Number(li.unit_price) || 0), 0) / laborItems.length : null;

    const taxRates = tradeProposals.map((p: any) => Number(p.tax_rate) || 0).filter((t: number) => t > 0);
    const avgTaxRate = taxRates.length ? taxRates.reduce((a: number, b: number) => a + b, 0) / taxRates.length : 0;

    const depositPcts: number[] = [];
    for (const p of tradeProposals) {
      if (p.deposit_mode === "percentage" && p.deposit_value) depositPcts.push(Number(p.deposit_value));
      else if (p.deposit_mode === "flat" && p.deposit_value && p.total && Number(p.total) > 0)
        depositPcts.push((Number(p.deposit_value) / Number(p.total)) * 100);
    }
    const avgDepositPct = depositPcts.length ? depositPcts.reduce((a, b) => a + b, 0) / depositPcts.length : 0;

    const termsCounts = new Map<string, number>();
    const warrantyCounts = new Map<string, number>();
    for (const p of tradeProposals) {
      if (p.payment_terms) termsCounts.set(p.payment_terms, (termsCounts.get(p.payment_terms) || 0) + 1);
      if (p.warranty_terms) warrantyCounts.set(p.warranty_terms, (warrantyCounts.get(p.warranty_terms) || 0) + 1);
    }
    const mostCommonPaymentTerms = [...termsCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const mostCommonWarranty = [...warrantyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    const sentProposals = proposals.filter((p: any) => p.status !== "draft");
    const wonProposals = proposals.filter((p: any) => WIN_STATUSES.has(p.status));
    const winRate = sentProposals.length > 0 ? Math.round((wonProposals.length / sentProposals.length) * 100) : null;

    const computedStats = {
      per_trade: {
        trade,
        proposal_count: tradeProposals.length,
        avg_total: Math.round(avgTotal * 100) / 100,
        median_total: Math.round(median(totals) * 100) / 100,
        common_line_items: commonLineItems,
        avg_labor_rate: avgLaborRate ? Math.round(avgLaborRate * 100) / 100 : null,
        avg_tax_rate: Math.round(avgTaxRate * 100) / 100,
        avg_deposit_pct: Math.round(avgDepositPct * 100) / 100,
        most_common_payment_terms: mostCommonPaymentTerms,
        most_common_warranty: mostCommonWarranty,
      },
      cross_trade: {
        total_proposals_all_trades: proposals.length,
        win_rate: winRate,
      },
    };

    // Persist computed stats now (fast write); AI synthesis runs in background.
    try {
      if (cached) {
        await supabaseAdmin.from("user_intelligence_cache").update({
          trade_type: trade,
          computed_stats: computedStats,
          proposal_count_at_computation: proposals.length,
          updated_at: new Date().toISOString(),
        }).eq("user_id", contextUserId);
      } else {
        await supabaseAdmin.from("user_intelligence_cache").insert({
          user_id: contextUserId,
          trade_type: trade,
          computed_stats: computedStats,
          intelligence_profile: null,
          proposal_count_at_computation: proposals.length,
        });
      }
    } catch (e) {
      console.error("Cache write error:", e);
    }

    // Kick off AI synthesis in background — does NOT block the response.
    try {
      // @ts-ignore EdgeRuntime is provided by Supabase Edge Runtime
      EdgeRuntime.waitUntil(
        synthesizeIntelligenceBackground(
          supabaseAdmin, contextUserId, trade, job_description || "", job_address || "",
          computedStats, proposals.length, cached
        )
      );
    } catch {
      // Fallback: ignore — stats are already returned to caller.
    }

    return new Response(JSON.stringify({
      has_sufficient_history: true,
      proposal_count: proposals.length,
      computed_stats: computedStats,
      intelligence_profile: cached?.intelligence_profile || null,
      cache_hit: false,
      ai_synthesis_pending: !cached?.intelligence_profile,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("build-user-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
