import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MODEL: claude-haiku-4-5-20251001 — pricing/materials suggestion (not in core list, structured output)
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;
const FN_NAME = "suggest-materials-pricing";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trade_type, job_description, job_site_address, user_context, pricing_benchmarks, job_state, materials_context } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const tradeLabel = (trade_type || "general_contractor").replace(/_/g, " ");
    const locationContext = job_site_address?.trim()
      ? `The job is located in ${job_site_address}. Use regionally accurate pricing.`
      : `No specific location provided. Use general US market pricing.`;

    const prompt = `You are an experienced ${tradeLabel} contractor and estimator.

JOB DESCRIPTION:
${job_description || "General " + tradeLabel + " work"}

LOCATION:
${locationContext}

Provide:
1. A detailed list of line items with realistic regional pricing. Each needs description, quantity, unit, unit_price.
2. "materials_included" text listing included materials.
3. "materials_excluded" text listing materials/work NOT included.

Be specific and realistic.`;

    const systemPrompt = `You are a trade contractor pricing expert. Provide accurate regional estimates.${pricing_benchmarks?.length ? ` Benchmarks: ${JSON.stringify(pricing_benchmarks)}` : ""}${user_context?.contractor_insights?.length ? ` Insights: ${user_context.contractor_insights.join(". ")}` : ""}${(Array.isArray(materials_context) && materials_context.length > 0 && job_state) ? `\n\nCURRENT MATERIALS PRICING DATA for ${job_state}:\n${JSON.stringify(materials_context)}` : ""}`;

    console.log(`[AI CALL] function: ${FN_NAME} | model: ${MODEL} | task: pricing | tokens: ${MAX_TOKENS}`);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: "suggest_materials_pricing",
            description: "Return suggested line items and materials lists",
            input_schema: {
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
                materials_included: { type: "string" },
                materials_excluded: { type: "string" },
              },
              required: ["line_items", "materials_included", "materials_excluded"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "suggest_materials_pricing" },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${response.status} ${t.slice(0, 300)}`);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Anthropic API error");
    }

    const data = await response.json();
    console.log(`[AI RESPONSE] function: ${FN_NAME} | model: ${MODEL} | tokens_used: ${data?.usage?.input_tokens ?? "?"} in / ${data?.usage?.output_tokens ?? "?"} out | status: success`);
    const toolUse = (data.content || []).find((c: any) => c.type === "tool_use");
    if (!toolUse) {
      return new Response(JSON.stringify({ line_items: [], materials_included: "", materials_excluded: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(toolUse.input), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${e instanceof Error ? e.message : "unknown"}`);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
