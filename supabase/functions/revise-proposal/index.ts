import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { proposal, revisionNote, lineItems, revisionHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build conversation context from previous revisions
    const historyContext = Array.isArray(revisionHistory) && revisionHistory.length > 0
      ? `\n\nPREVIOUS REVISION REQUESTS (for context):\n${revisionHistory.map((h: any, i: number) => `${i + 1}. User asked: "${h.request}" → Changed: ${JSON.stringify(h.changes)}`).join('\n')}\n`
      : '';

    // Build line items summary for pricing context
    const lineItemsSummary = Array.isArray(lineItems) && lineItems.length > 0
      ? `\nLINE ITEMS:\n${lineItems.map((li: any, i: number) => `  ${i + 1}. "${li.description}" — qty: ${li.quantity}, unit: ${li.unit || 'ea'}, unit_price: ${li.unit_price}, subtotal: ${li.subtotal}`).join('\n')}\n`
      : '\nNo line items currently.\n';

    const prompt = `You are a professional proposal editor for contractors. A user has a proposal and wants the following revision. You can change text content, visual template style, financial settings, AND line items/pricing.

IMPORTANT RULES:
- Only change fields that the user's revision request actually asks for.
- Do NOT append text to special_conditions unless the user specifically asks to add a special condition.
- CRITICAL: If the user asks about cosmetic/visual changes (colors, logo size, layout, font, theme, design, look, appearance, style), use the appropriate field: template for overall style, logo_size for logo sizing, logo_position for logo placement. NEVER put cosmetic notes into text fields like special_conditions.
- Template options: classic (dark header, formal), modern (colored accents, clean), minimal (sparse, light), bold (large type, strong borders), executive (elegant, refined).
- Logo size options: small, medium, large. Logo position options: left, center, right. When the user says "logo", "company logo", or refers to the image/branding at the top, use logo_size and/or logo_position.
- For pricing changes: you can modify line_items (add, remove, update quantities/prices), tax_rate, deposit_mode, deposit_value. When modifying line items, return the FULL updated line_items array with recalculated subtotals. Each item needs: description, quantity, unit, unit_price, subtotal (quantity * unit_price).
- When changing pricing, always recalculate: subtotal (sum of line item subtotals), tax_amount (subtotal * tax_rate / 100), total (subtotal + tax_amount), deposit_amount, and balance_due.
${historyContext}
REVISION REQUEST: "${revisionNote}"

CURRENT PROPOSAL:
- Title: ${proposal.title || "Untitled"}
- Template style: ${proposal.template || "classic"}
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
- Subtotal: ${proposal.subtotal || 0}
- Total: ${proposal.total || 0}
- Logo Size: ${proposal.logo_size || "medium"} (options: small, medium, large)
- Logo Position: ${proposal.logo_position || "left"} (options: left, center, right)
${lineItemsSummary}
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
          { role: "system", content: "You revise contractor proposals based on user instructions. You can change text, visual template style, logo size/position, financial terms, and line items with pricing math. Return only the changed fields as JSON. CRITICAL: NEVER put cosmetic/visual requests into text fields like special_conditions — use template, logo_size, or logo_position instead. For pricing changes, recalculate all totals." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_revised_proposal",
              description: "Return the revised proposal fields. Only include fields that changed. For cosmetic/visual requests, use the template field. Never append cosmetic notes to special_conditions. For pricing changes, include recalculated totals.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Proposal title" },
                  template: { type: "string", enum: ["classic", "modern", "minimal", "bold", "executive"], description: "Visual template style — use this for any cosmetic/visual change requests" },
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
                  subtotal: { type: "number" },
                  tax_amount: { type: "number" },
                  total: { type: "number" },
                  deposit_amount: { type: "number" },
                  balance_due: { type: "number" },
                  line_items: {
                    type: "array",
                    description: "Full updated line items array. Only include if pricing changes were requested.",
                    items: {
                      type: "object",
                      properties: {
                        description: { type: "string" },
                        quantity: { type: "number" },
                        unit: { type: "string" },
                        unit_price: { type: "number" },
                        subtotal: { type: "number" },
                      },
                      required: ["description", "quantity", "unit_price", "subtotal"],
                    },
                  },
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
