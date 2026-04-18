import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MODEL: claude-haiku-4-5-20251001 — short classification/recommendation task
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;
const FN_NAME = "recommend-template";

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

    const { description } = await req.json();
    if (!description || typeof description !== "string" || description.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Please describe the vibe you're looking for." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const systemPrompt = `You are a design advisor for contractor proposal templates.

Available templates:
- classic: Clean black header with company logo, traditional layout. Best for: general contractors, established businesses, formal clients.
- modern: Colored accent bar at top, bold colored section headers. Best for: tech-savvy contractors, residential remodels.
- minimal: No color, pure typography, ultra-clean whitespace. Best for: high-end clients, architects, design-build firms.
- bold: Strong left border accent, large headings. Best for: standing out, aggressive bids, roofing/concrete.
- executive: Formal double-line border, elegant serif feel. Best for: commercial, large bids, corporate clients, luxury work.
- contractor: Work-order style with numbered sections, bordered header. Best for: subcontractors, trade-specific bids, service calls.
- premium: Luxury centered layout with gold accents. Best for: high-end residential, custom homes, luxury renovations.
- clean: Simple two-column header, modern business layout. Best for: small businesses, versatile general use.

Based on the user's description, recommend the BEST template and explain why in 1-2 sentences. Also rank all 8 from best to worst fit.`;

    console.log(`[AI CALL] function: ${FN_NAME} | model: ${MODEL} | task: recommend | tokens: ${MAX_TOKENS}`);

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
        messages: [{ role: "user", content: description }],
        tools: [
          {
            name: "recommend_template",
            description: "Return template recommendation with reasoning",
            input_schema: {
              type: "object",
              properties: {
                recommended: { type: "string", enum: ["classic", "modern", "minimal", "bold", "executive", "contractor", "premium", "clean"] },
                reason: { type: "string" },
                ranked: { type: "array", items: { type: "string", enum: ["classic", "modern", "minimal", "bold", "executive", "contractor", "premium", "clean"] } },
              },
              required: ["recommended", "reason", "ranked"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "recommend_template" },
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
    if (!toolUse) throw new Error("No recommendation returned");

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
