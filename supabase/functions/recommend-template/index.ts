import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description } = await req.json();
    if (!description || typeof description !== "string" || description.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Please describe the vibe you're looking for." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a design advisor for contractor proposal templates. You help tradespeople pick the right look for their proposals.

Available templates:
- classic: Clean black header with company logo, traditional layout with clear sections. Best for: general contractors, established businesses, formal clients.
- modern: Colored accent bar at top, bold colored section headers, contemporary feel. Best for: tech-savvy contractors, younger businesses, residential remodels.
- minimal: No color, pure typography, ultra-clean whitespace. Best for: high-end clients, architects, design-build firms, minimalist branding.
- bold: Strong left border accent in brand color, large headings, high contrast. Best for: standing out, aggressive bids, roofing/concrete, making an impact.
- executive: Formal double-line border, elegant serif feel, professional and polished. Best for: commercial projects, large bids, corporate clients, luxury work.
- contractor: Work-order style with numbered sections, bordered header, job-site ready feel. Best for: subcontractors, trade-specific bids, service calls, handyman work.
- premium: Luxury centered layout with gold accents and elegant spacing. Best for: high-end residential, custom homes, luxury renovations, design-build.
- clean: Simple two-column header, modern business layout with colored section headers. Best for: small businesses, clean branding, versatile general use.

Based on the user's description, recommend the BEST template and explain why in 1-2 sentences. Also rank all 8 from best to worst fit.`
          },
          { role: "user", content: description },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recommend_template",
              description: "Return template recommendation with reasoning",
              parameters: {
                type: "object",
                properties: {
                  recommended: {
                    type: "string",
                    enum: ["classic", "modern", "minimal", "bold", "executive", "contractor", "premium", "clean"],
                    description: "The best template for this vibe"
                  },
                  reason: {
                    type: "string",
                    description: "1-2 sentence explanation of why this template fits"
                  },
                  ranked: {
                    type: "array",
                    items: { type: "string", enum: ["classic", "modern", "minimal", "bold", "executive", "contractor", "premium", "clean"] },
                    description: "All 8 templates ranked from best to worst fit"
                  }
                },
                required: ["recommended", "reason", "ranked"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "recommend_template" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No recommendation returned");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-template error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
