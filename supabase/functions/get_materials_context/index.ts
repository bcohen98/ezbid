import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Material {
  name: string;
  unit: string;
  price_low: number;
  price_high: number;
  source?: string;
  last_refreshed?: string;
  region?: string;
}

function roundPrice(price: number): number {
  if (price < 50) return Math.round(price * 2) / 2; // nearest $0.50
  if (price <= 500) return Math.round(price / 5) * 5; // nearest $5
  return Math.round(price / 25) * 25; // nearest $25
}

function regionalAdjustment(state: string): number {
  const s = state.toUpperCase();
  if (s === "FL" || s === "TX") return 0.06;
  if (["CA", "NY", "MA", "WA", "OR", "CT"].includes(s)) return 0.08;
  return 0;
}

function calcSuggestedPrice(low: number, high: number, state: string): number {
  let base: number;
  if (high > low * 2.5) {
    base = low * 1.4;
  } else {
    base = (low + high) / 2;
  }
  const adjusted = base * (1 + regionalAdjustment(state));
  return roundPrice(adjusted);
}

async function fetchWithTimeout(url: string, opts: RequestInit, ms = 4000): Promise<Response | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(t);
    return res;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trade, state_code } = await req.json().catch(() => ({}));

    if (!trade || !state_code) {
      return new Response(JSON.stringify({ materials: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("MATERIALS_SUPABASE_URL");
    const key = Deno.env.get("MATERIALS_SUPABASE_ANON_KEY");
    if (!url || !key) {
      return new Response(JSON.stringify({ materials: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const select = "select=name,unit,price_low,price_high,source,last_refreshed,region";

    const [stateRes, natRes] = await Promise.all([
      fetchWithTimeout(`${url}/rest/v1/materials_catalog?trade=eq.${encodeURIComponent(trade)}&region=eq.${encodeURIComponent(state_code)}&${select}&limit=20`, { headers }),
      fetchWithTimeout(`${url}/rest/v1/materials_catalog?trade=eq.${encodeURIComponent(trade)}&region=eq.national&${select}&limit=40`, { headers }),
    ]);

    let stateRows: Material[] = [];
    let natRows: Material[] = [];

    try {
      if (stateRes?.ok) stateRows = await stateRes.json();
    } catch {}
    try {
      if (natRes?.ok) natRows = await natRes.json();
    } catch {}

    // Merge: state takes priority by name
    const map = new Map<string, Material>();
    for (const r of natRows) {
      if (r?.name) map.set(r.name.toLowerCase(), r);
    }
    for (const r of stateRows) {
      if (r?.name) map.set(r.name.toLowerCase(), r);
    }

    const merged = Array.from(map.values()).slice(0, 40);

    const enriched = merged.map((m) => ({
      ...m,
      suggested_price: calcSuggestedPrice(Number(m.price_low) || 0, Number(m.price_high) || 0, state_code),
    }));

    return new Response(JSON.stringify({ materials: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get_materials_context error:", e);
    // Never block proposal generation
    return new Response(JSON.stringify({ materials: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
