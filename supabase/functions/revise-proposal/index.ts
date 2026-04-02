import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { proposal, revisionNote } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are a professional proposal editor for contractors. A user has a proposal and wants the following revision. You can change BOTH text content AND visual/layout aspects.

REVISION REQUEST: "${revisionNote}"

CURRENT PROPOSAL:
- Title: ${proposal.title || "Untitled"}
- Template style: ${proposal.template || "classic"} (options: classic, modern, minimal, bold, executive)
- Job Description: ${proposal.job_description || "N/A"}
- Scope of Work: ${proposal.scope_of_work || "N/A"}
- Materials Included: ${proposal.materials_included || "N/A"}
- Materials Excluded: ${proposal.materials_excluded || "N/A"}
- Warranty Terms: ${proposal.warranty_terms || "N/A"}
- Payment Terms: ${proposal.payment_terms || "N/A"}
- Disclosures: ${proposal.disclosures || "N/A"}
- Special Conditions: ${proposal.special_conditions || "N/A"}
- Estimated Duration: ${proposal.estimated_duration || "N/A"}
- Deposit Mode: ${proposal.deposit_mode || "percentage"} (options: percentage, flat)
- Deposit Value: ${proposal.deposit_value || 0}
- Tax Rate: ${proposal.tax_rate || 0}

Apply the requested revision. You can change:
- Text fields (title, descriptions, terms, etc.)
- Template style (classic/modern/minimal/bold/executive)
- Financial terms (deposit_mode, deposit_value, tax_rate)
- Timeline (estimated_duration)

Only return the fields that need to change. Keep unchanged fields out of the response.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You revise contractor proposals based on user instructions. You can change text, visual template style, and financial terms. Return only the changed fields as JSON." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_revised_proposal",
              description: "Return the revised proposal fields. Only include fields that changed.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Proposal title" },
                  template: { type: "string", enum: ["classic", "modern", "minimal", "bold", "executive"], description: "Visual template style" },
                  job_description: { type: "string" },
                  scope_of_work: { type: "string" },
                  materials_included: { type: "string" },
                  materials_excluded: { type: "string" },
                  warranty_terms: { type: "string" },
                  payment_terms: { type: "string" },
                  disclosures: { type: "string" },
                  special_conditions: { type: "string" },
                  estimated_duration: { type: "string" },
                  deposit_mode: { type: "string", enum: ["percentage", "flat"] },
                  deposit_value: { type: "number" },
                  tax_rate: { type: "number" },
                },
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_revised_proposal" } },
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
    const revised = toolCall ? JSON.parse(toolCall.function.arguments) : {};

    return new Response(JSON.stringify({ revised }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("revise-proposal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
