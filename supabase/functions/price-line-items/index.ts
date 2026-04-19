// Two-step pricing with deterministic unit normalization, deduplication, and quantity validation.
// STEP 1: Sonnet returns line item names + quantities (no prices).
// STEP 2: Code dedupes, looks up catalog, validates units & quantities. Haiku fallback for misses.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "x-ai-routing-log",
};

// MODEL: claude-sonnet-4-20250514 (STEP 1) — line item list generation requires trade domain knowledge
const STEP1_MODEL = "claude-sonnet-4-20250514";
const STEP1_MAX_TOKENS = 4096;
// MODEL: claude-haiku-4-5-20251001 (STEP 2 fallback + qty correction) — short structured outputs
const STEP2_MODEL = "claude-haiku-4-5-20251001";
const STEP2_MAX_TOKENS = 1024;
const FN_NAME = "price-line-items";

// ─────────────────────────────────────────────────────────────────────────────
// UNIT NORMALIZATION & CONVERSION
// ─────────────────────────────────────────────────────────────────────────────

const UNIT_EQUIVALENCE: Record<string, string[]> = {
  each: ["each", "ea", "unit", "units", "pc", "pcs", "piece", "pieces"],
  roll: ["roll", "rolls"],
  square: ["square", "squares", "sq", "roofing square", "roofing squares"],
  sqft: ["sq ft", "sqft", "square foot", "square feet", "sf", "ft2", "ft^2"],
  linearft: ["lf", "linear foot", "linear feet", "lineal ft", "lin ft", "linft"],
  bundle: ["bundle", "bundles", "bdl"],
  lot: ["lot", "ls", "lump sum", "allowance"],
  bag: ["bag", "bags"],
  gallon: ["gallon", "gallons", "gal"],
  box: ["box", "boxes", "bx"],
  sheet: ["sheet", "sheets"],
  yard: ["yard", "yards", "yd", "cy", "cubic yard", "cubic yards"],
  ton: ["ton", "tons"],
  lb: ["lb", "lbs", "pound", "pounds"],
  foot: ["foot", "feet", "ft"],
  hour: ["hr", "hrs", "hour", "hours"],
  day: ["day", "days"],
  pallet: ["pallet", "pallets"],
};

function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = String(unit).toLowerCase().trim().replace(/\.$/, "");
  for (const [canonical, aliases] of Object.entries(UNIT_EQUIVALENCE)) {
    if (aliases.includes(u)) return canonical;
  }
  return null;
}

// Conversion factor from key1 → key2 (multiply line-item qty/price as noted at use site).
// Key format: "<from>_to_<to>".
const UNIT_CONVERSIONS: Record<string, number> = {
  sqft_to_square: 0.01,    // 100 sqft = 1 square
  square_to_sqft: 100,
  foot_to_linearft: 1,     // treat foot as linearft for lineal materials
  linearft_to_foot: 1,
};

/**
 * Decide whether a catalog price can be applied to the line item.
 * Returns:
 *  - { ok: true, priceMultiplier: 1 }  — units match exactly
 *  - { ok: true, priceMultiplier: N }  — units convertible; multiply catalog unit_price by N
 *  - { ok: false }                     — incompatible, reject the catalog match
 *
 * priceMultiplier is what you multiply the CATALOG unit_price by so it equals
 * the price per ONE line-item-unit.
 *   e.g. catalog is $/sqft, line item is per square (100 sqft) → multiplier = 100.
 */
function reconcileUnits(lineItemUnit: string, catalogUnit: string): { ok: boolean; priceMultiplier: number; canonicalLine: string | null; canonicalCatalog: string | null } {
  const a = normalizeUnit(lineItemUnit);
  const b = normalizeUnit(catalogUnit);
  if (!a || !b) return { ok: false, priceMultiplier: 1, canonicalLine: a, canonicalCatalog: b };
  if (a === b) return { ok: true, priceMultiplier: 1, canonicalLine: a, canonicalCatalog: b };
  const key = `${b}_to_${a}`; // catalog → line item
  if (key in UNIT_CONVERSIONS) {
    return { ok: true, priceMultiplier: UNIT_CONVERSIONS[key], canonicalLine: a, canonicalCatalog: b };
  }
  return { ok: false, priceMultiplier: 1, canonicalLine: a, canonicalCatalog: b };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEDUPLICATION
// ─────────────────────────────────────────────────────────────────────────────

const STRIP_PREFIXES = [
  "furnish and install",
  "furnish & install",
  "supply and install",
  "supply & install",
  "provide and install",
  "remove and replace",
  "install",
  "supply",
  "provide",
  "furnish",
  "new",
];

function normalizeName(name: string): string {
  let n = String(name || "").toLowerCase().trim();
  for (const p of STRIP_PREFIXES) {
    if (n.startsWith(p + " ")) { n = n.slice(p.length + 1); break; }
  }
  return n.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

interface ClaudeLineItem { name: string; quantity: number; unit: string; type: "material" | "labor"; }

function dedupeLineItems(items: ClaudeLineItem[], log: string[]): ClaudeLineItem[] {
  const groups = new Map<string, ClaudeLineItem[]>();
  for (const it of items) {
    const key = normalizeName(it.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }
  const kept: ClaudeLineItem[] = [];
  for (const [, group] of groups) {
    if (group.length === 1) { kept.push(group[0]); continue; }
    // Keep the one with the highest quantity (proxy for most specific / job-sized)
    const winner = group.reduce((best, cur) => (cur.quantity > best.quantity ? cur : best), group[0]);
    for (const g of group) {
      if (g !== winner) {
        const msg = `[DEDUPE] removed: "${g.name}" | reason: duplicate of "${winner.name}"`;
        console.log(msg);
        log.push(msg);
      }
    }
    kept.push(winner);
  }
  return kept;
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────────────────────────────────────

interface CatalogRow {
  id?: string;
  name: string;
  unit: string;
  price_low: number;
  price_high: number;
  region?: string;
  source?: string;
  typical_job_qty?: string | null;
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

function calcCatalogPrice(low: number, high: number, state: string | null | undefined, multiplier: number): number {
  const base = high > low * 2.5 ? low * 1.4 : (low + high) / 2;
  const adjusted = base * (1 + regionalAdjust(state)) * multiplier;
  return roundPrice(adjusted);
}

async function fetchCatalog(trade: string, state: string | null): Promise<CatalogRow[]> {
  const url = Deno.env.get("MATERIALS_SUPABASE_URL");
  const key = Deno.env.get("MATERIALS_SUPABASE_ANON_KEY");
  if (!url || !key || !trade) return [];
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const select = "select=id,name,unit,price_low,price_high,source,region,typical_job_qty";
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
    const map = new Map<string, CatalogRow>();
    for (const r of rows) if (r?.name) map.set(r.name.toLowerCase(), r);
    return [...map.values()];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// QUANTITY VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function parseQtyRange(s: string | null | undefined): { low: number; high: number } | null {
  if (!s) return null;
  const m = String(s).match(/(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const low = Number(m[1]);
  const high = Number(m[2]);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return { low, high };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTHROPIC
// ─────────────────────────────────────────────────────────────────────────────

async function callAnthropic(model: string, system: string, user: string, maxTokens: number, task: string): Promise<{ text: string; in: number; out: number }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  console.log(`[AI CALL] function: ${FN_NAME} | model: ${model} | task: ${task} | tokens: ${maxTokens}`);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[AI ERROR] function: ${FN_NAME} | model: ${model} | error: ${res.status} ${txt.slice(0, 300)}`);
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = await res.json();
  const tIn = data?.usage?.input_tokens ?? 0;
  const tOut = data?.usage?.output_tokens ?? 0;
  console.log(`[AI RESPONSE] function: ${FN_NAME} | model: ${model} | tokens_used: ${tIn} in / ${tOut} out | status: success`);
  const txt = (data.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
  return { text: txt || "", in: tIn, out: tOut };
}

function extractJson<T = any>(text: string): T | null {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const arrMatch = cleaned.match(/\[[\s\S]*\]/);
  const objMatch = cleaned.match(/\{[\s\S]*\}/);
  const candidate = arrMatch?.[0] || objMatch?.[0] || cleaned;
  try { return JSON.parse(candidate) as T; } catch { return null; }
}

async function step1_getLineItemList(trade: string, jobDescription: string, contractorContext: string | null) {
  const system = `You are an experienced ${trade.replace(/_/g, " ")} contractor and estimator. Your only job is to decide WHICH line items belong on a proposal and the QUANTITY of each. You MUST NOT include any prices, dollar amounts, or cost estimates. Return only valid JSON — an array of line items.

Each line item has exactly these fields:
- name: short descriptive name
- quantity: numeric quantity for the job
- unit: the unit of measure ("square","roll","bundle","piece","lot","sqft","lf","hr","ea","day","gal","ton","yd","bag","box","pallet")
- type: "material" or "labor"

Rules:
- Pick units that match how this trade is actually quoted.
- Quantities must be reasonable estimates for the job size described.
- Include both materials AND labor items.
- Do NOT list the same material twice with different phrasings.
- DO NOT include any prices, costs, dollar amounts, or unit_price fields.
- Return ONLY the JSON array, no prose.

NAMING CONVENTION (CRITICAL):
Generate line item names that are generic trade-standard material descriptions, not brand-specific. For example:
- Use "Interior Wall Paint - Eggshell" not "Sherwin Williams Agreeable Gray SW7029"
- Use "Interior Ceiling Paint - Flat White" not "Behr Ceiling Paint Ultra Pure White"
- Use "Interior Trim Paint - Semi-Gloss White" not "Benjamin Moore Advance White"
- Use "Primer - Interior Drywall" not "Zinsser Bulls Eye 1-2-3"
- Use "Painter's Tape - 2 inch" not "3M ScotchBlue Painter's Tape"
- Use "Drop Cloths - Canvas" not any brand name
Exception: if the client specifically requested a brand in the job description, include it in the line item name.`;

  const user = `TRADE: ${trade}
JOB DESCRIPTION:
${jobDescription || "(no description provided)"}
${contractorContext ? `\nCONTRACTOR CONTEXT:\n${contractorContext}` : ""}

Return the JSON array of line items now.`;

  const r = await callAnthropic(STEP1_MODEL, system, user, STEP1_MAX_TOKENS, "step1_items");
  const parsed = extractJson<ClaudeLineItem[]>(r.text);
  const items = Array.isArray(parsed)
    ? parsed.filter(li => li && typeof li.name === "string" && typeof li.quantity === "number" && typeof li.unit === "string")
    : [];
  return { items, tokensIn: r.in, tokensOut: r.out };
}

async function step2_estimatePrice(item: ClaudeLineItem, trade: string, state: string | null): Promise<{ price: number; in: number; out: number }> {
  const system = `You are a ${trade.replace(/_/g, " ")} pricing expert. Return a single realistic CURRENT MARKET unit price in US dollars for the line item. No markup. Return ONLY a JSON object: {"unit_price": <number>}. No prose.

Use these contractor labor rate ranges when pricing service or labor line items:

Painting: wall/ceiling painting $1.50-3.00/sqft, surface prep $0.50-1.50/sqft, priming $0.75-1.50/sqft, masking/protection $45-65/hr, cleanup $45-65/hr

Roofing: tear-off/removal $0.50-1.50/sqft, shingle installation $1.50-4.00/sqft, flashing installation $8-15/lf, ridge cap $5-10/lf

HVAC: equipment installation $500-2000/unit, ductwork $8-15/lf, refrigerant charging $150-300/unit, diagnostic $85-150/hr

Plumbing: fixture installation $150-400/ea, pipe installation $15-40/lf, drain cleaning $150-300/ea, service call $85-150/hr

Electrical: outlet/switch $50-150/ea, panel work $75-150/hr, wire pulling $2-5/lf, fixture installation $75-150/ea

Flooring: installation $2-6/sqft, subfloor prep $1-3/sqft, baseboard $3-6/lf, carpet $1-3/sqft

Landscaping: planting $45-85/hr, grading $75-150/hr, sod installation $0.50-1.50/sqft, mulch $35-65/hr

Pressure Washing: house $0.15-0.35/sqft, driveway $0.10-0.25/sqft, deck $0.25-0.50/sqft

Foundation: excavation $50-150/hr, concrete $8-15/sqft, waterproofing $3-8/sqft, crack repair $300-800/ea

General Contracting: framing $5-15/sqft, drywall $2-5/sqft, general labor $45-85/hr

NEVER price labor items using retail product prices. Always estimate within these ranges based on job complexity and scope.`;
  const user = `Item: ${item.name}
Quantity: ${item.quantity}
Unit: ${item.unit}
Type: ${item.type}
${state ? `State: ${state}` : ""}

Return {"unit_price": N} now.`;
  try {
    const r = await callAnthropic(STEP2_MODEL, system, user, STEP2_MAX_TOKENS, "step2_estimate");
    const parsed = extractJson<{ unit_price: number }>(r.text);
    const p = Number(parsed?.unit_price);
    return { price: Number.isFinite(p) && p >= 0 ? p : 0, in: r.in, out: r.out };
  } catch (e) {
    console.error("[step2] estimate fail:", item.name, e);
    return { price: 0, in: 0, out: 0 };
  }
}

// Single batched call to correct flagged quantities
async function batchCorrectQuantities(
  flagged: Array<{ name: string; unit: string; current: number; range: { low: number; high: number } }>,
  trade: string,
  jobDescription: string,
): Promise<Record<string, number>> {
  if (flagged.length === 0) return {};
  const system = `You are a ${trade.replace(/_/g, " ")} estimator. For each item below, the current quantity falls outside the typical range. Return corrected quantities as JSON: {"corrections": [{"name": "...", "quantity": N}, ...]}. Only include items whose quantity should change. Output JSON only.`;
  const user = `JOB: ${jobDescription || "(none)"}\n\nFLAGGED ITEMS:\n${flagged.map(f => `- ${f.name} | unit: ${f.unit} | current_qty: ${f.current} | typical_range: ${f.range.low}-${f.range.high}`).join("\n")}\n\nReturn corrections JSON now.`;
  try {
    const r = await callAnthropic(STEP2_MODEL, system, user, STEP2_MAX_TOKENS, "qty_correction");
    const parsed = extractJson<{ corrections: Array<{ name: string; quantity: number }> }>(r.text);
    const out: Record<string, number> = {};
    if (parsed?.corrections && Array.isArray(parsed.corrections)) {
      for (const c of parsed.corrections) {
        if (c?.name && Number.isFinite(c.quantity) && c.quantity > 0) out[c.name] = c.quantity;
      }
    }
    return out;
  } catch (e) {
    console.error("[qty_correction] failed:", e);
    return {};
  }
}

function ok(body: Record<string, unknown>, routingLog: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "x-ai-routing-log": JSON.stringify(routingLog),
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const routing = {
    function: FN_NAME,
    models: [] as string[],
    tokens_in: 0,
    tokens_out: 0,
    catalog_match_rate: 0,
    unit_rejections: 0,
    qty_corrections: 0,
    dedupe_removed: 0,
  };
  const dedupeLog: string[] = [];

  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const { trade, job_description, job_state, job_zip, contractor_context } = body || {};

    if (!trade) {
      return ok({ ok: false, error: "trade is required", line_items: [], catalog_matched: 0, estimated: 0, total: 0 }, routing);
    }

    // STEP 1
    let claudeItems: ClaudeLineItem[] = [];
    try {
      const r = await step1_getLineItemList(trade, job_description || "", contractor_context || null);
      claudeItems = r.items;
      routing.models.push(STEP1_MODEL);
      routing.tokens_in += r.tokensIn;
      routing.tokens_out += r.tokensOut;
    } catch (e) {
      console.error(`[${FN_NAME}] step1 failed:`, e);
      return ok({ ok: false, error: e instanceof Error ? e.message : "step1 failed", line_items: [], catalog_matched: 0, estimated: 0, total: 0, stage: "step1" }, routing);
    }

    if (claudeItems.length === 0) {
      return ok({ ok: true, line_items: [], catalog_matched: 0, estimated: 0, total: 0 }, routing);
    }

    // DEDUPE (code-only, deterministic)
    const beforeCount = claudeItems.length;
    claudeItems = dedupeLineItems(claudeItems, dedupeLog);
    routing.dedupe_removed = beforeCount - claudeItems.length;

    // CATALOG FETCH — live Home Depot pricing via get_materials_context
    const LABOR_KEYWORDS = ["labor","installation","install","prep","preparation","priming","laying","pouring","framing","wiring","running","pulling","masking","cleanup","touch-up","touchup","protection","moving","haul","disposal","demolition","demo","excavation","grading","leveling","trenching","inspection","permit","mobilization","teardown","removal","rental","diagnostic","commissioning","testing","balancing","startup","service call","painting walls","painting ceilings","paint walls","paint ceilings","seal coat","pressure wash","power wash"];
    const MATERIAL_UNITS = new Set(["gal","gallon","roll","ea","each","sheet","piece","bag","box","lb","ft","lf","bundle","square","ton","yard","lot","pallet"]);
    function isMaterialItem(item: ClaudeLineItem): boolean {
      const unitNorm = normalizeUnit(item.unit);
      const unitOk = MATERIAL_UNITS.has(item.unit?.toLowerCase?.() ?? "") || MATERIAL_UNITS.has(unitNorm ?? "");
      const nameLower = item.name.toLowerCase();
      const nameOk = !LABOR_KEYWORDS.some(kw => nameLower.includes(kw));
      return unitOk && nameOk;
    }
    const materialItemsForHD = claudeItems.filter(isMaterialItem);
    const laborItems = claudeItems.filter(i => !isMaterialItem(i));
    console.log(`[HD FILTER] total: ${claudeItems.length} | sending to HD: ${materialItemsForHD.length} | labor/service (skip HD): ${laborItems.length}`);

    let catalog: CatalogRow[] = [];
    try {
      const supaUrl = Deno.env.get("SUPABASE_URL");
      const supaKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (supaUrl && supaKey && job_zip) {
        const res = await fetch(`${supaUrl}/functions/v1/get_materials_context`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supaKey,
            Authorization: `Bearer ${supaKey}`,
          },
          body: JSON.stringify({
            trade,
            state_code: job_state || null,
            line_items: materialItemsForHD.map(i => ({ name: i.name, unit: i.unit })),
            zip: job_zip,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const data = await res.json();
          const materials = Array.isArray(data?.materials) ? data.materials : [];
          catalog = materials.map((m: any) => ({
            id: null,
            name: m.name,
            unit: m.unit,
            price_low: Number(m.price_low) || 0,
            price_high: Number(m.price_high) || 0,
            source: m.source || "home_depot_live",
            region: null,
            typical_job_qty: null,
          })) as CatalogRow[];
          console.log(`[${FN_NAME}] get_materials_context returned ${catalog.length} live HD prices`);
        } else {
          console.error(`[${FN_NAME}] get_materials_context returned ${res.status}`);
        }
      } else {
        console.log(`[${FN_NAME}] skipping get_materials_context (missing zip or supabase env)`);
      }
    } catch (e) {
      console.error(`[${FN_NAME}] get_materials_context fetch failed:`, e);
      catalog = [];
    }

    // PRICING + UNIT RECONCILIATION
    type Priced = { item: ClaudeLineItem; row?: CatalogRow; multiplier?: number; unit_price: number; price_source: "catalog" | "estimated"; matched_catalog_id: string | null; matched_catalog_name: string | null };
    const intermediate: Priced[] = [];
    let matched = 0;
    let estimated = 0;

    // Build direct-name lookup map for live HD results (no fuzzy matching)
    const hdMap = new Map<string, CatalogRow>();
    for (const c of catalog) {
      if (c.source === "home_depot_live" && c.name) {
        hdMap.set(c.name.toLowerCase(), c);
      }
    }

    for (const item of claudeItems) {
      try {
        // 1) Direct name lookup for live HD prices
        const hd = hdMap.get(item.name.toLowerCase());
        if (hd) {
          const price = (Number(hd.price_low) + Number(hd.price_high)) / 2;
          console.log(`[HD MATCH] item: ${item.name} | matched_product: ${hd.name} | price: $${price} | source: home_depot_live`);
          intermediate.push({
            item, row: hd, multiplier: 1, unit_price: roundPrice(price),
            price_source: "catalog",
            matched_catalog_id: hd.id || null,
            matched_catalog_name: hd.name,
          });
          matched++;
          continue;
        }
        // 2) Fall back to fuzzy catalog match (legacy non-HD rows, if any)
        const m = bestMatch(item.name, catalog.filter(c => c.source !== "home_depot_live"));
        if (m) {
          const rec = reconcileUnits(item.unit, m.row.unit);
          const action = rec.ok ? "applied" : "rejected";
          console.log(`[UNIT CHECK] item: ${item.name} | line_item_unit: ${item.unit} | catalog_unit: ${m.row.unit} | normalized_match: ${rec.canonicalLine === rec.canonicalCatalog} | conversion: ${rec.priceMultiplier !== 1 ? rec.priceMultiplier : "none"} | action: ${action}`);
          if (rec.ok) {
            const unit_price = calcCatalogPrice(Number(m.row.price_low) || 0, Number(m.row.price_high) || 0, job_state, rec.priceMultiplier);
            intermediate.push({
              item, row: m.row, multiplier: rec.priceMultiplier, unit_price,
              price_source: "catalog",
              matched_catalog_id: m.row.id || null,
              matched_catalog_name: m.row.name,
            });
            matched++;
            continue;
          } else {
            routing.unit_rejections++;
          }
        }
        // fall through → Haiku estimate
        const est = await step2_estimatePrice(item, trade, job_state || null);
        routing.tokens_in += est.in;
        routing.tokens_out += est.out;
        if (!routing.models.includes(STEP2_MODEL)) routing.models.push(STEP2_MODEL);
        intermediate.push({
          item, unit_price: est.price,
          price_source: "estimated",
          matched_catalog_id: null,
          matched_catalog_name: null,
        });
        estimated++;
      } catch (itemErr) {
        console.error(`[${FN_NAME}] item "${item?.name}" failed:`, itemErr);
        intermediate.push({
          item, unit_price: 0,
          price_source: "estimated",
          matched_catalog_id: null,
          matched_catalog_name: null,
        });
        estimated++;
      }
    }

    // QTY VALIDATION using catalog typical_job_qty
    const flagged: Array<{ name: string; unit: string; current: number; range: { low: number; high: number } }> = [];
    for (const p of intermediate) {
      const range = parseQtyRange(p.row?.typical_job_qty || null);
      const isFlagged = !!(range && (p.item.quantity < range.low * 0.5 || p.item.quantity > range.high * 3));
      console.log(`[QTY CHECK] item: ${p.item.name} | claude_qty: ${p.item.quantity} | catalog_range: ${range ? `${range.low}-${range.high}` : "n/a"} | flagged: ${isFlagged}`);
      if (isFlagged && range) {
        flagged.push({ name: p.item.name, unit: p.item.unit, current: p.item.quantity, range });
      }
    }
    if (flagged.length > 0) {
      const corrections = await batchCorrectQuantities(flagged, trade, job_description || "");
      // tokens for correction call were logged inside callAnthropic but not added here; add minimal:
      if (Object.keys(corrections).length > 0 && !routing.models.includes(STEP2_MODEL)) routing.models.push(STEP2_MODEL);
      for (const p of intermediate) {
        if (corrections[p.item.name]) {
          const newQ = corrections[p.item.name];
          console.log(`[QTY CHECK] item: ${p.item.name} | corrected_to: ${newQ}`);
          p.item.quantity = newQ;
          routing.qty_corrections++;
        }
      }
    }

    routing.catalog_match_rate = intermediate.length > 0 ? matched / intermediate.length : 0;

    const priced = intermediate.map(p => ({
      description: p.item.name,
      quantity: p.item.quantity,
      unit: p.item.unit,
      unit_price: p.unit_price,
      type: p.item.type,
      price_source: p.price_source,
      matched_catalog_id: p.matched_catalog_id,
      matched_catalog_name: p.matched_catalog_name,
    }));

    return ok({
      ok: true,
      line_items: priced,
      catalog_matched: matched,
      estimated,
      total: priced.length,
      dedupe_removed: routing.dedupe_removed,
      unit_rejections: routing.unit_rejections,
      qty_corrections: routing.qty_corrections,
    }, routing);
  } catch (e) {
    console.error(`[${FN_NAME}] UNHANDLED:`, e, (e as any)?.stack);
    return ok({
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
      line_items: [], catalog_matched: 0, estimated: 0, total: 0,
      stage: "unhandled",
    }, routing);
  }
});
