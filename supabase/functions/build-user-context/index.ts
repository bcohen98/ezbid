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

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

const MATERIAL_KEYWORDS = [
  "material", "supply", "supplies", "lumber", "concrete", "shingle", "tile",
  "paint", "flooring", "pipe", "wire", "drywall", "insulation", "fixture",
  "equipment", "asphalt", "gravel", "sand", "plywood", "adhesive", "sealant",
  "hardware", "bolt", "screw", "nail", "bracket", "flashing", "membrane",
];

const LABOR_KEYWORDS = ["labor", "install", "installation", "hrs", "hours", "work", "crew"];

function isMaterial(desc: string): boolean {
  const d = desc.toLowerCase();
  return MATERIAL_KEYWORDS.some(k => d.includes(k));
}

function isLabor(desc: string): boolean {
  const d = desc.toLowerCase();
  return LABOR_KEYWORDS.some(k => d.includes(k));
}

const WIN_STATUSES = new Set(["signed", "accepted", "work_pending", "payment_pending", "closed"]);

// Fuzzy deduplicate descriptions: group within edit distance 2
function fuzzyGroup(descs: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const d of descs) {
    const dl = d.toLowerCase().trim();
    let matched = false;
    for (const [key, members] of groups) {
      if (levenshtein(dl, key) <= 2) {
        members.push(dl);
        matched = true;
        break;
      }
    }
    if (!matched) groups.set(dl, [dl]);
  }
  return groups;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    // Auth required
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { trade, job_description, job_address, target_user_id, force_refresh } = body;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Allow admin to build context for another user
    let contextUserId = user.id;
    if (target_user_id && target_user_id !== user.id) {
      // Verify caller is admin
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      contextUserId = target_user_id;
    }

    // ─── STEP A: Data Retrieval ───

    const [proposalsRes, profileRes] = await Promise.all([
      supabaseAdmin.from("proposals")
        .select("id, trade_type, title, job_description, job_site_street, job_site_city, job_site_state, total, subtotal, tax_rate, deposit_value, deposit_mode, payment_terms, warranty_terms, created_at, status, estimated_duration")
        .eq("user_id", contextUserId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin.from("company_profiles")
        .select("trade_type, city, state, company_name, owner_name")
        .eq("user_id", contextUserId)
        .single(),
    ]);

    const proposals = proposalsRes.data || [];
    const companyProfile = profileRes.data;

    if (proposals.length < 3) {
      return new Response(JSON.stringify({
        has_sufficient_history: false,
        message: "Insufficient proposal history for personalized intelligence",
        user_context: null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check cache
    const { data: cached } = await supabaseAdmin
      .from("user_intelligence_cache")
      .select("*")
      .eq("user_id", contextUserId)
      .single();

    if (!force_refresh && cached && cached.proposal_count_at_computation === proposals.length) {
      return new Response(JSON.stringify({
        has_sufficient_history: true,
        proposal_count: proposals.length,
        computed_stats: cached.computed_stats,
        intelligence_profile: cached.intelligence_profile,
        cache_hit: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch line items for all proposals
    const proposalIds = proposals.map((p: any) => p.id);
    const { data: allLineItems } = await supabaseAdmin
      .from("proposal_line_items")
      .select("proposal_id, description, quantity, unit, unit_price, subtotal")
      .in("proposal_id", proposalIds);

    const lineItemsByProposal = new Map<string, any[]>();
    for (const li of (allLineItems || [])) {
      const arr = lineItemsByProposal.get(li.proposal_id) || [];
      arr.push(li);
      lineItemsByProposal.set(li.proposal_id, arr);
    }

    // ─── STEP B: Statistical Analysis ───

    const currentTradeProposals = proposals.filter((p: any) => p.trade_type === trade);
    // Cap to most recent 30 to keep CPU bounded under edge runtime limits
    const tradeProposals = (currentTradeProposals.length >= 3 ? currentTradeProposals : proposals).slice(0, 30);

    // Per-trade metrics
    const totals = tradeProposals.map((p: any) => Number(p.total) || 0).filter((t: number) => t > 0);
    const avgTotal = totals.length ? totals.reduce((a: number, b: number) => a + b, 0) / totals.length : 0;
    const medianTotal = median(totals);
    const minTotal = totals.length ? Math.min(...totals) : 0;
    const maxTotal = totals.length ? Math.max(...totals) : 0;

    // Line item counts
    const liCounts = tradeProposals.map((p: any) => (lineItemsByProposal.get(p.id) || []).length);
    const avgLiCount = liCounts.length ? liCounts.reduce((a: number, b: number) => a + b, 0) / liCounts.length : 0;

    // Common line items (fuzzy dedup)
    const allTradeItems = tradeProposals.flatMap((p: any) => lineItemsByProposal.get(p.id) || []);
    const descList = allTradeItems.map((li: any) => li.description);
    const groups = fuzzyGroup(descList);
    const totalItems = descList.length || 1;

    const commonLineItems = [...groups.entries()]
      .map(([canonical, members]) => {
        const matchingItems = allTradeItems.filter((li: any) => {
          const d = li.description.toLowerCase().trim();
          return members.includes(d) || levenshtein(d, canonical) <= 2;
        });
        const prices = matchingItems.map((li: any) => Number(li.unit_price) || 0);
        const quantities = matchingItems.map((li: any) => Number(li.quantity) || 0);
        const units = matchingItems.map((li: any) => li.unit || "ea");
        const modeUnit = units.sort((a: string, b: string) =>
          units.filter((v: string) => v === a).length - units.filter((v: string) => v === b).length
        ).pop() || "ea";
        return {
          description: matchingItems[0]?.description || canonical,
          frequency_pct: Math.round((members.length / totalItems) * 100),
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

    // Labor efficiency
    const laborItems = allTradeItems.filter((li: any) => isLabor(li.description));
    const avgLaborRate = laborItems.length
      ? laborItems.reduce((s: number, li: any) => s + (Number(li.unit_price) || 0), 0) / laborItems.length
      : null;

    // Material to labor ratio
    const ratios: number[] = [];
    for (const p of tradeProposals) {
      const pItems = lineItemsByProposal.get(p.id) || [];
      let matSum = 0, labSum = 0;
      for (const li of pItems) {
        const sub = Number(li.subtotal) || (Number(li.quantity) * Number(li.unit_price));
        if (isMaterial(li.description)) matSum += sub;
        else labSum += sub;
      }
      if (labSum > 0) ratios.push(matSum / labSum);
    }
    const materialToLaborRatio = ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null;

    // Tax, deposit, terms
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

    // Geographic
    const states = new Set(tradeProposals.map((p: any) => p.job_site_state).filter(Boolean));
    const cities = new Set(tradeProposals.map((p: any) => p.job_site_city).filter(Boolean));
    const geographicPricingIndex = states.size > 1
      ? { multi_market: true, states: [...states], cities: [...cities] }
      : null;

    // Cross-trade metrics
    const tradeCountMap = new Map<string, number>();
    for (const p of proposals) {
      const t = p.trade_type || "other";
      tradeCountMap.set(t, (tradeCountMap.get(t) || 0) + 1);
    }
    const tradesWorked = [...tradeCountMap.entries()].map(([t, c]) => ({ trade: t, count: c }));
    const primaryTrade = tradesWorked.sort((a, b) => b.count - a.count)[0]?.trade || null;

    const allTotals = proposals.map((p: any) => Number(p.total) || 0).filter((t: number) => t > 0);
    const avgTotalAllTrades = allTotals.length ? allTotals.reduce((a: number, b: number) => a + b, 0) / allTotals.length : 0;

    // Busiest month
    const monthCounts = new Map<string, number>();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    for (const p of proposals) {
      if (p.created_at) {
        const m = new Date(p.created_at).getMonth();
        const name = monthNames[m];
        monthCounts.set(name, (monthCounts.get(name) || 0) + 1);
      }
    }
    const busiestMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Win rate
    const sentProposals = proposals.filter((p: any) => p.status !== "draft");
    const wonProposals = proposals.filter((p: any) => WIN_STATUSES.has(p.status));
    const winRate = sentProposals.length > 0 ? Math.round((wonProposals.length / sentProposals.length) * 100) : null;

    // Recent trend (last 10 in trade)
    const recent10 = tradeProposals.slice(0, 10);
    const recent10Totals = recent10.map((p: any) => Number(p.total) || 0).filter((t: number) => t > 0);
    const trendAvgTotal = recent10Totals.length ? recent10Totals.reduce((a: number, b: number) => a + b, 0) / recent10Totals.length : 0;

    const recent5Items = new Set(
      tradeProposals.slice(0, 5).flatMap((p: any) => (lineItemsByProposal.get(p.id) || []).map((li: any) => li.description.toLowerCase().trim()))
    );
    const older5Items = new Set(
      tradeProposals.slice(5).flatMap((p: any) => (lineItemsByProposal.get(p.id) || []).map((li: any) => li.description.toLowerCase().trim()))
    );
    const recentlyAdded = [...recent5Items].filter(d => !older5Items.has(d));
    const recentlyDropped = [...older5Items].filter(d => !recent5Items.has(d));

    const computedStats = {
      per_trade: {
        trade,
        proposal_count: tradeProposals.length,
        avg_total: Math.round(avgTotal * 100) / 100,
        median_total: Math.round(medianTotal * 100) / 100,
        min_total: Math.round(minTotal * 100) / 100,
        max_total: Math.round(maxTotal * 100) / 100,
        avg_line_item_count: Math.round(avgLiCount * 10) / 10,
        common_line_items: commonLineItems,
        avg_labor_rate: avgLaborRate ? Math.round(avgLaborRate * 100) / 100 : null,
        material_to_labor_ratio: materialToLaborRatio ? Math.round(materialToLaborRatio * 100) / 100 : null,
        avg_tax_rate: Math.round(avgTaxRate * 100) / 100,
        avg_deposit_pct: Math.round(avgDepositPct * 100) / 100,
        most_common_payment_terms: mostCommonPaymentTerms,
        most_common_warranty: mostCommonWarranty,
        geographic_pricing_index: geographicPricingIndex,
      },
      cross_trade: {
        total_proposals_all_trades: proposals.length,
        trades_worked: tradesWorked,
        primary_trade: primaryTrade,
        avg_total_all_trades: Math.round(avgTotalAllTrades * 100) / 100,
        busiest_month: busiestMonth,
        win_rate: winRate,
      },
      recent_trend: {
        trend_avg_total: Math.round(trendAvgTotal * 100) / 100,
        overall_avg_total: Math.round(avgTotal * 100) / 100,
        trending: trendAvgTotal > avgTotal ? "higher" : trendAvgTotal < avgTotal ? "lower" : "stable",
        recently_added_line_items: recentlyAdded.slice(0, 10),
        recently_dropped_line_items: recentlyDropped.slice(0, 10),
      },
    };

    // Check timeout
    if (Date.now() - startTime > 8000) {
      return new Response(JSON.stringify({
        has_sufficient_history: true,
        proposal_count: proposals.length,
        computed_stats: computedStats,
        intelligence_profile: null,
        partial_compute: true,
        cache_hit: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── STEP C: AI Pattern Synthesis ───

    let intelligenceProfile = null;
    let aiSynthesisFailed = false;

    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("No LOVABLE_API_KEY");

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are an expert construction industry analyst and pricing intelligence engine. You are given statistical data derived from a specific contractor's real proposal history. Your job is to synthesize this data into a structured intelligence profile that will be used to generate more accurate, personalized proposal suggestions for this contractor. Be precise, specific, and grounded in the data. Do not hallucinate patterns that are not supported by the statistics. If data is insufficient for a conclusion, say so. Return only valid JSON matching the schema provided.",
            },
            {
              role: "user",
              content: `Here is the contractor's proposal statistics:\n\n${JSON.stringify(computedStats, null, 2)}\n\nCurrent job context: Trade: ${trade}, Job description: ${job_description || "Not provided"}, Location: ${job_address || "Not provided"}. Based on this contractor's history, synthesize a personalized intelligence profile.`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_user_intelligence",
                description: "Return the synthesized intelligence profile",
                parameters: {
                  type: "object",
                  properties: {
                    pricing_personality: { type: "string", enum: ["budget_friendly", "mid_market", "premium", "variable"] },
                    pricing_confidence: { type: "string", enum: ["high", "medium", "low"] },
                    signature_line_items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          description: { type: "string" },
                          suggested_quantity: { type: "number" },
                          suggested_unit: { type: "string" },
                          suggested_unit_price: { type: "number" },
                          confidence: { type: "string", enum: ["high", "medium", "low"] },
                          reason: { type: "string" },
                        },
                      },
                    },
                    pricing_benchmarks: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          line_item_type: { type: "string" },
                          learned_unit_price: { type: "number" },
                          learned_unit: { type: "string" },
                          price_range_low: { type: "number" },
                          price_range_high: { type: "number" },
                          based_on_n_proposals: { type: "number" },
                          confidence: { type: "string", enum: ["high", "medium", "low"] },
                        },
                      },
                    },
                    smart_defaults: {
                      type: "object",
                      properties: {
                        suggested_tax_rate: { type: "number" },
                        suggested_deposit_pct: { type: "number" },
                        suggested_payment_terms: { type: "string" },
                        suggested_warranty_terms: { type: "string" },
                        suggested_deposit_mode: { type: "string", enum: ["percentage", "flat"] },
                      },
                    },
                    job_size_estimate: {
                      type: "object",
                      properties: {
                        estimated_total_low: { type: "number" },
                        estimated_total_mid: { type: "number" },
                        estimated_total_high: { type: "number" },
                        estimated_line_item_count: { type: "number" },
                        sizing_rationale: { type: "string" },
                      },
                    },
                    clarifying_question_priorities: { type: "array", items: { type: "string" } },
                    contractor_insights: { type: "array", items: { type: "string" } },
                    anomaly_flags: { type: "array", items: { type: "string" } },
                  },
                  required: ["pricing_personality", "pricing_confidence", "signature_line_items", "pricing_benchmarks", "smart_defaults", "job_size_estimate", "clarifying_question_priorities", "contractor_insights"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_user_intelligence" } },
        }),
      });

      if (!aiResponse.ok) {
        console.error("AI gateway error:", aiResponse.status);
        aiSynthesisFailed = true;
      } else {
        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall) {
          intelligenceProfile = typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
        } else {
          aiSynthesisFailed = true;
        }
      }
    } catch (e) {
      console.error("AI synthesis error:", e);
      aiSynthesisFailed = true;
    }

    // ─── STEP D: Cache ───

    try {
      if (cached) {
        await supabaseAdmin.from("user_intelligence_cache").update({
          trade_type: trade,
          computed_stats: computedStats,
          intelligence_profile: intelligenceProfile,
          proposal_count_at_computation: proposals.length,
          updated_at: new Date().toISOString(),
        }).eq("user_id", contextUserId);
      } else {
        await supabaseAdmin.from("user_intelligence_cache").insert({
          user_id: contextUserId,
          trade_type: trade,
          computed_stats: computedStats,
          intelligence_profile: intelligenceProfile,
          proposal_count_at_computation: proposals.length,
        });
      }
    } catch (e) {
      console.error("Cache write error:", e);
    }

    return new Response(JSON.stringify({
      has_sufficient_history: true,
      proposal_count: proposals.length,
      computed_stats: computedStats,
      intelligence_profile: intelligenceProfile,
      cache_hit: false,
      ...(aiSynthesisFailed ? { ai_synthesis_failed: true } : {}),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("build-user-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
