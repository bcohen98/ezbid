import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trade_type, job_description, job_site_address, user_context, pricing_benchmarks, job_state, materials_context } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const tradeLabel = (trade_type || "general_contractor").replace(/_/g, " ");
    const locationContext = job_site_address?.trim()
      ? `The job is located in ${job_site_address}. Use regionally accurate pricing for that area (labor rates, material costs, permit fees typical for that region).`
      : `No specific location provided. Use general US market pricing.`;

    const prompt = `You are an experienced ${tradeLabel} contractor and estimator.

JOB DESCRIPTION:
${job_description || "General " + tradeLabel + " work"}

LOCATION:
${locationContext}

Based on this trade type, job description, and location, provide:

1. A detailed list of line items with realistic pricing for the region. Each line item needs a description, quantity, unit (ea, sq ft, hr, lf, cu yd, gal, etc.), and unit_price. Include both labor and materials as separate line items where appropriate.

2. A "materials_included" text listing all materials that are included in the quote (e.g., "30-year architectural shingles, synthetic underlayment, galvanized flashing, ridge vent...").

3. A "materials_excluded" text listing materials or work NOT included (e.g., "Structural repairs, gutters, interior painting, permits...").

Be specific and realistic. Use actual market pricing for the region. Quantities should be reasonable estimates based on the job description.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You are a trade contractor pricing expert. Provide accurate regional estimates.${pricing_benchmarks?.length ? ` This contractor has learned pricing benchmarks from their history. Use these learned_unit_price values as defaults where the line item type matches. Only deviate if the job description clearly indicates a different scope or scale. Benchmarks: ${JSON.stringify(pricing_benchmarks)}` : ""}${user_context?.contractor_insights?.length ? ` Contractor insights: ${user_context.contractor_insights.join(". ")}` : ""}${(Array.isArray(materials_context) && materials_context.length > 0 && job_state) ? `\n\nYou have access to current market pricing data for ${tradeLabel} contractors in ${job_state}. This data is sourced from real supplier and market pricing updated regularly.\n\nCURRENT MATERIALS PRICING DATA:\n${JSON.stringify(materials_context)}\n\nPRICING INSTRUCTIONS:\n- When a material in your line item suggestions matches or closely matches something in the pricing data above, use its suggested_price field as your unit_price — this is a single pre-calculated value, use it directly\n- Never return a price range — always return one specific dollar amount per line item\n- For materials not in the pricing data, estimate a realistic single price based on current market rates for ${job_state}\n- For labor line items, estimate based on current regional labor rates for ${job_state}\n- Never return zero or blank for any price\n- Do not apply any markup — return raw material and labor market rates only` : ""}` },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_materials_pricing",
              description: "Return suggested line items and materials lists",
              parameters: {
                type: "object",
                properties: {
                  line_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        quantity: { type: "number" },
                        unit: { type: "string" },
                        unit_price: { type: "number" },
                      },
                      required: ["description", "quantity", "unit", "unit_price"],
                    },
                  },
                  materials_included: { type: "string", description: "Bullet-point or comma-separated list of included materials" },
                  materials_excluded: { type: "string", description: "Bullet-point or comma-separated list of excluded materials/work" },
                },
                required: ["line_items", "materials_included", "materials_excluded"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_materials_pricing" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ line_items: [], materials_included: "", materials_excluded: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;
    try {
      result = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch {
      return new Response(JSON.stringify({ line_items: [], materials_included: "", materials_excluded: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-materials-pricing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
