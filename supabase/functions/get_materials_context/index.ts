import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { line_items, zip, trade } = await req.json().catch(() => ({}));

    if (!line_items?.length || !zip) {
      return new Response(JSON.stringify({ materials: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serpKey = Deno.env.get("SERPAPI_KEY");
    if (!serpKey) {
      console.error("[get_materials_context] SERPAPI_KEY not configured");
      return new Response(JSON.stringify({ materials: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const searchItem = async (item: { name: string; unit: string }) => {
      try {
        const q = encodeURIComponent(item.name);
        const url = `https://serpapi.com/search?engine=home_depot&q=${q}&delivery_zip=${zip}&ps=3&api_key=${serpKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const data = await res.json();
        const product = data?.products?.[0];
        if (!product?.price) return null;
        const price = Number(product.price);
        console.log(`[HD PRICE] item: ${item.name} | matched: ${product.title} | price: $${price} | zip: ${zip}`);
        return {
          name: item.name,
          matched_product: product.title,
          price_low: Math.round(price * 0.9 * 100) / 100,
          price_high: Math.round(price * 1.1 * 100) / 100,
          suggested_price: price,
          unit: item.unit,
          source: "home_depot_live",
        };
      } catch {
        console.log(`[HD PRICE] failed for: ${item.name}`);
        return null;
      }
    };

    const results = await Promise.all(line_items.map(searchItem));
    const materials = results.filter(Boolean);

    console.log(`[get_materials_context] ${materials.length}/${line_items.length} items matched from Home Depot`);

    return new Response(JSON.stringify({ materials }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("[get_materials_context] error:", e);
    return new Response(JSON.stringify({ materials: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
