import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { proposal, line_items, trade_type, company_name } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const tradeLabel = trade_type ? trade_type.replace(/_/g, ' ') : 'general contractor';

    const prompt = `You are a professional proposal writer specializing in the ${tradeLabel} trade${company_name ? ` for ${company_name}` : ''}. Polish and improve the following proposal content to sound more professional, clear, and persuasive. Use industry-specific terminology and phrasing appropriate for a ${tradeLabel} professional.

Consider the full context of the job — the title, description, and scope of work — to ensure polished text is coherent and tailored to this specific type of work. For example, a roofing proposal should reference roofing-specific best practices, while a plumbing proposal should use plumbing terminology.

IMPORTANT RULES:
- Do NOT change any numbers (quantities, prices, amounts)
- Do NOT add new line items or remove existing ones
- Do NOT change client names, emails, phones, or addresses
- Polish text fields: title, job_description, scope_of_work, materials_included, materials_excluded, payment_terms, warranty_terms, disclosures, special_conditions
- Polish line item descriptions only (keep qty, unit, unit_price unchanged)
- If a field is empty or null, leave it empty
- Use trade-appropriate language for the ${tradeLabel} industry
- Return the polished version as a JSON object with the same field names

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
${(line_items || []).map((li: any, i: number) => `${i + 1}. "${li.description}" (${li.quantity} ${li.unit} @ $${li.unit_price})`).join('\n')}

Return ONLY a JSON object with these keys: title, job_description, scope_of_work, materials_included, materials_excluded, payment_terms, warranty_terms, disclosures, special_conditions, estimated_duration, line_item_descriptions (array of polished description strings in order).`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [
          { role: "user", content: prompt },
        ],
        tools: [
          {
            name: "return_polished_proposal",
            description: "Return the polished proposal fields and line item descriptions",
            input_schema: {
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
            },
          },
        ],
        tool_choice: { type: "tool", name: "return_polished_proposal" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Anthropic error:", response.status, t);
      throw new Error("Anthropic API error");
    }

    const data = await response.json();
    const toolUse = data.content?.find((block: any) => block.type === "tool_use");
    if (!toolUse) throw new Error("No polished content returned");

    const result = toolUse.input;

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
