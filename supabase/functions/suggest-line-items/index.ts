import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MODEL: claude-haiku-4-5-20251001 — small structured suggestion task, not in core list
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;
const FN_NAME = "suggest-line-items";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    let user = null;
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabaseUser = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: authUser } } = await supabaseUser.auth.getUser();
      user = authUser;
    }

    const { trade, job_description, existing_items } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const tradeLabel = (trade || "general_contractor").replace(/_/g, " ");

    const existingList = (existing_items || [])
      .map((li: any, i: number) => `${i + 1}. ${li.description} (${li.unit})`)
      .join("\n");

    const prompt = `You are an experienced ${tradeLabel} contractor reviewing a job description and existing quote line items.

JOB DESCRIPTION:
${job_description}

EXISTING LINE ITEMS:
${existingList || "None"}

Identify any work, materials, fees, or tasks mentioned in the description that are NOT already covered. Only suggest items clearly implied by the job description — do NOT add generic padding.

If the existing items already cover everything, return an empty suggestions array.

For each suggested item provide a description, appropriate unit (ea, sq ft, hr, lf, cu yd, gal, etc), and a suggested quantity. Set unit_price to 0 (the user will fill in pricing).`;

    console.log(`[AI CALL] function: ${FN_NAME} | model: ${MODEL} | task: suggest | tokens: ${MAX_TOKENS}`);

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
        system: "You are a trade contractor expert. Analyze job descriptions and suggest missing line items.",
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: "suggest_items",
            description: "Return suggested missing line items",
            input_schema: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      quantity: { type: "number" },
                      unit: { type: "string" },
                      unit_price: { type: "number" },
                      reason: { type: "string" },
                    },
                    required: ["description", "quantity", "unit", "unit_price", "reason"],
                  },
                },
              },
              required: ["suggestions"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "suggest_items" },
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
      return new Response(JSON.stringify({ suggestions: [] }), {
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
