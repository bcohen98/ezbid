import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { proposal, line_items } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `You are a professional proposal writer for contractors and tradespeople. Polish and improve the following proposal content to sound more professional, clear, and persuasive. Fix grammar, spelling, and punctuation. Make descriptions more compelling. Keep the same meaning and scope.

IMPORTANT RULES:
- Do NOT change any numbers (quantities, prices, amounts)
- Do NOT add new line items or remove existing ones
- Do NOT change client names, emails, phones, or addresses
- Polish text fields: title, job_description, scope_of_work, materials_included, materials_excluded, payment_terms, warranty_terms, disclosures, special_conditions
- Polish line item descriptions only (keep qty, unit, unit_price unchanged)
- If a field is empty or null, leave it empty
- Return the polished version in the same structure

Current proposal:
Title: ${proposal.title || ''}
Job Description: ${proposal.job_description || ''}
Scope of Work: ${proposal.scope_of_work || ''}
Materials Included: ${proposal.materials_included || ''}
Materials Excluded: ${proposal.materials_excluded || ''}
Payment Terms: ${proposal.payment_terms || ''}
Warranty Terms: ${proposal.warranty_terms || ''}
Disclosures: ${proposal.disclosures || ''}
Special Conditions: ${proposal.special_conditions || ''}
Estimated Duration: ${proposal.estimated_duration || ''}

Line Items:
${(line_items || []).map((li: any, i: number) => `${i + 1}. "${li.description}" (${li.quantity} ${li.unit} @ $${li.unit_price})`).join('\n')}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You polish contractor proposals. Return only the function call with polished content." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_polished_proposal",
              description: "Return the polished proposal fields and line item descriptions",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Polished title" },
                  job_description: { type: "string", description: "Polished job description" },
                  scope_of_work: { type: "string", description: "Polished scope of work" },
                  materials_included: { type: "string", description: "Polished materials included" },
                  materials_excluded: { type: "string", description: "Polished materials excluded" },
                  payment_terms: { type: "string", description: "Polished payment terms" },
                  warranty_terms: { type: "string", description: "Polished warranty terms" },
                  disclosures: { type: "string", description: "Polished disclosures" },
                  special_conditions: { type: "string", description: "Polished special conditions" },
                  estimated_duration: { type: "string", description: "Polished estimated duration" },
                  line_item_descriptions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Polished descriptions for each line item, in order",
                  },
                },
                required: ["title", "line_item_descriptions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_polished_proposal" } },
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
    if (!toolCall) throw new Error("No polished content returned");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("polish-proposal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
