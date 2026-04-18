// Two-step pricing: STEP 1 Anthropic returns line item names (no prices),
// STEP 2 we look up each item in the materials_catalog table; if no match,
// we ask Anthropic for a single-item price estimate and flag it as "estimated".
//
// External catalog source is read via MATERIALS_SUPABASE_URL / MATERIALS_SUPABASE_ANON_KEY.
// All future supplier integrations (ABC Supply, Ferguson, etc.) plug into this file only —
// the Claude step never touches a number that exists in any catalog.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// Use current generally-available models. Older dated snapshots (e.g. -20241022) return 404.
const PRIMARY_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-3-5-haiku-latest";
const FALLBACK_MODEL = "claude-3-haiku-20240307";

interface ClaudeLineItem { name: string; quantity: number; unit: string; type: "material" | "labor"; }

interface CatalogRow {
  id?: string;
  name: string;
  unit: string;
  price_low: number;
  price_high: number;
  region?: string;
  source?: string;
}

const SIGNIFICANT_STOPWORDS = new Set([
  "and","or","with","for","the","a","an","of","in","on","to","per","each","new","old"
]);

function tokenize(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2 && !SIGNIFICANT_STOPWORDS.has(t));
}

function bestMatch(claudeName: string, rows: CatalogRow[]): { row: CatalogRow; score: number } | null {
  const claudeTokens = new Set(tokenize(claudeName));
  if (claudeTokens.size === 0) return null;
  let best: { row: CatalogRow; score: number } | null = null;
  for (const r of rows) {
    const rowTokens = new Set(tokenize(r.name));
    let overlap = 0;
    for (const t of claudeTokens) if (rowTokens.has(t)) overlap++;
    if (overlap >= 2 && (!best || overlap > best.score)) {
      best = { row: r, score: overlap };
    }
  }
  return best;
}

function regionalAdjust(state?: string | null): number {
  if (!state) return 0;
  const s = state.toUpperCase();
  if (s === "FL" || s === "TX") return 0.06;
  if (["CA","NY","MA","WA","OR","CT"].includes(s)) return 0.08;
  return 0;
}

function roundPrice(p: number): number {
  if (p < 50) return Math.round(p * 2) / 2;
  if (p <= 500) return Math.round(p / 5) * 5;
  return Math.round(p / 25) * 25;
}

function calcCatalogPrice(low: number, high: number, state?: string | null): number {
  const base = high > low * 2.5 ? low * 1.4 : (low + high) / 2;
  return roundPrice(base * (1 + regionalAdjust(state)));
}

async function fetchCatalog(trade: string, state: string | null): Promise<CatalogRow[]> {
  const url = Deno.env.get("MATERIALS_SUPABASE_URL");
  const key = Deno.env.get("MATERIALS_SUPABASE_ANON_KEY");
  if (!url || !key || !trade) return [];
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const select = "select=id,name,unit,price_low,price_high,source,region";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const queries: Promise<Response>[] = [
      fetch(`${url}/rest/v1/materials_catalog?trade=eq.${encodeURIComponent(trade)}&region=eq.national&${select}&limit=80`, { headers, signal: ctrl.signal }),
    ];
    if (state) {
      queries.push(fetch(`${url}/rest/v1/materials_catalog?trade=eq.${encodeURIComponent(trade)}&region=eq.${encodeURIComponent(state)}&${select}&limit=40`, { headers, signal: ctrl.signal }));
    }
    const results = await Promise.all(queries);
    clearTimeout(timer);
    const rows: CatalogRow[] = [];
    for (const r of results) {
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) rows.push(...data);
      }
    }
    // De-dup by lowercase name; state takes precedence (last in wins via map)
    const map = new Map<string, CatalogRow>();
    for (const r of rows) if (r?.name) map.set(r.name.toLowerCase(), r);
    return [...map.values()];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

async function callAnthropicWithModel(model: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<Response> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  return fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
}

async function callAnthropic(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<string> {
  let res = await callAnthropicWithModel(PRIMARY_MODEL, systemPrompt, userPrompt, maxTokens);
  if (res.status === 404 || res.status === 400) {
    const errTxt = await res.text();
    console.warn(`[anthropic] primary model "${PRIMARY_MODEL}" failed (${res.status}): ${errTxt.slice(0, 200)} — retrying with fallback "${FALLBACK_MODEL}"`);
    res = await callAnthropicWithModel(FALLBACK_MODEL, systemPrompt, userPrompt, maxTokens);
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.content?.[0]?.text || "";
}

function extractJson<T = any>(text: string): T | null {
  // Strip code fences and find JSON
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  // Try to find first JSON array or object
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  const candidate = arrMatch?.[0] || objMatch?.[0] || cleaned;
  try { return JSON.parse(candidate) as T; } catch { return null; }
}

async function step1_getLineItemList(
  trade: string, jobDescription: string, contractorContext: string | null
): Promise<ClaudeLineItem[]> {
  const system = `You are an experienced ${trade.replace(/_/g, " ")} contractor and estimator. Your only job is to decide WHICH line items belong on a proposal and the QUANTITY of each. You MUST NOT include any prices, dollar amounts, or cost estimates. Return only valid JSON — an array of line items.

Each line item has exactly these fields:
- name: short descriptive name (e.g. "30yr Architectural Shingles", "Tear off and disposal")
- quantity: numeric quantity for the job
- unit: the unit of measure ("square","roll","bundle","piece","lot","sqft","lf","hr","ea","day","gal","ton","yd","bag","box","pallet")
- type: "material" or "labor"

Rules:
- Pick units that match how this trade is actually quoted (e.g. roofing materials in "square" or "bundle", lumber in "lf" or "piece").
- Quantities must be reasonable estimates for the job size described.
- Include both materials AND labor items.
- DO NOT include any prices, costs, dollar amounts, or unit_price fields.
- Return ONLY the JSON array, no prose.`;

  const user = `TRADE: ${trade}
JOB DESCRIPTION:
${jobDescription || "(no description provided)"}
${contractorContext ? `\nCONTRACTOR CONTEXT:\n${contractorContext}` : ""}

Return the JSON array of line items now.`;

  const text = await callAnthropic(system, user, 1500);
  const parsed = extractJson<ClaudeLineItem[]>(text);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(li => li && typeof li.name === "string" && typeof li.quantity === "number" && typeof li.unit === "string");
}

async function step2_estimatePrice(
  item: ClaudeLineItem, trade: string, state: string | null
): Promise<number> {
  const system = `You are a ${trade.replace(/_/g, " ")} pricing expert. Return a single realistic CURRENT MARKET unit price in US dollars for the line item below. No markup. Return ONLY a JSON object: {"unit_price": <number>}. No prose.`;
  const user = `Item: ${item.name}
Quantity: ${item.quantity}
Unit: ${item.unit}
Type: ${item.type}
${state ? `State: ${state}` : ""}

Return {"unit_price": N} now.`;
  try {
    const text = await callAnthropic(system, user, 100);
    const parsed = extractJson<{ unit_price: number }>(text);
    const p = Number(parsed?.unit_price);
    return Number.isFinite(p) && p >= 0 ? p : 0;
  } catch (e) {
    console.error("[step2] estimate fail:", item.name, e);
    return 0;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trade, job_description, job_state, contractor_context } = await req.json().catch(() => ({}));
    if (!trade) {
      return new Response(JSON.stringify({ error: "trade is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 1 — Claude decides what (no prices)
    const claudeItems = await step1_getLineItemList(trade, job_description || "", contractor_context || null);
    console.log("[price-line-items] Claude returned", claudeItems.length, "items");

    if (claudeItems.length === 0) {
      return new Response(JSON.stringify({
        line_items: [], catalog_matched: 0, estimated: 0, total: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // STEP 2 — Catalog lookup (deterministic) with Claude fallback for misses
    const catalog = await fetchCatalog(trade, job_state || null);
    console.log("[price-line-items] catalog rows fetched:", catalog.length);

    const priced: any[] = [];
    let matched = 0;
    let estimated = 0;

    for (const item of claudeItems) {
      const match = bestMatch(item.name, catalog);
      let unit_price = 0;
      let unit = item.unit;
      let price_source: "catalog" | "estimated" = "estimated";
      let matched_catalog_id: string | null = null;
      let matched_catalog_name: string | null = null;

      if (match) {
        const r = match.row;
        unit_price = calcCatalogPrice(Number(r.price_low) || 0, Number(r.price_high) || 0, job_state);
        unit = r.unit || item.unit; // prefer catalog unit for consistency
        price_source = "catalog";
        matched_catalog_id = r.id || null;
        matched_catalog_name = r.name;
        matched++;
      } else {
        unit_price = await step2_estimatePrice(item, trade, job_state || null);
        estimated++;
      }

      console.log(
        `[price-line-items] "${item.name}" → ${matched_catalog_name ? `matched "${matched_catalog_name}"` : "no match"} · $${unit_price} · ${price_source}`
      );

      priced.push({
        description: item.name,
        quantity: item.quantity,
        unit,
        unit_price,
        type: item.type,
        price_source,
        matched_catalog_id,
        matched_catalog_name,
      });
    }

    return new Response(JSON.stringify({
      line_items: priced,
      catalog_matched: matched,
      estimated,
      total: priced.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("price-line-items error:", e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : "Unknown error",
      line_items: [], catalog_matched: 0, estimated: 0, total: 0,
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
