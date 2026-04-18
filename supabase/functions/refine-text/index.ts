import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MODEL: claude-haiku-4-5-20251001 — light text refinement, not in core list
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;
const FN_NAME = "refine-text";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fields } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const fieldEntries = Object.entries(fields).filter(([_, v]) => (v as string)?.trim());
    if (fieldEntries.length === 0) {
      return new Response(JSON.stringify({ refined: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a professional writing assistant for a contractor's company profile. Refine the following text fields to improve grammar, spelling, punctuation, formatting, and professional writing style. Keep the same meaning and tone.

Fields to refine:
${fieldEntries.map(([k, v]) => `${k}: "${v}"`).join("\n")}

Return the refined fields via the tool.`;

    console.log(`[AI CALL] function: ${FN_NAME} | model: ${MODEL} | task: refine | tokens: ${MAX_TOKENS}`);

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
        system: "You refine text for grammar, spelling, and professional style.",
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: "return_refined_fields",
            description: "Return the refined text fields",
            input_schema: {
              type: "object",
              properties: {
                insurance_info: { type: "string" },
                default_payment_terms: { type: "string" },
                default_warranty: { type: "string" },
                default_disclosures: { type: "string" },
              },
            },
          },
        ],
        tool_choice: { type: "tool", name: "return_refined_fields" },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${response.status} ${t.slice(0, 300)}`);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Anthropic API error");
    }

    const data = await response.json();
    console.log(`[AI RESPONSE] function: ${FN_NAME} | model: ${MODEL} | tokens_used: ${data?.usage?.input_tokens ?? "?"} in / ${data?.usage?.output_tokens ?? "?"} out | status: success`);
    const toolUse = (data.content || []).find((c: any) => c.type === "tool_use");
    const refined = toolUse ? toolUse.input : {};

    return new Response(JSON.stringify({ refined }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${e instanceof Error ? e.message : "unknown"}`);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
