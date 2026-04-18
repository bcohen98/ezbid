import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MODEL: claude-sonnet-4-20250514 — AI revision requests; contractor instructions are often vague/ambiguous and require strong interpretation & context awareness
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;
const FN_NAME = "revise-proposal";

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

    const { proposal, revisionNote, lineItems, revisionHistory } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const historyContext = Array.isArray(revisionHistory) && revisionHistory.length > 0
      ? `\n\nPREVIOUS REVISION REQUESTS (for context):\n${revisionHistory.map((h: any, i: number) => `${i + 1}. User asked: "${h.request}" → Changed: ${JSON.stringify(h.changes)}`).join('\n')}\n`
      : '';

    const lineItemsSummary = Array.isArray(lineItems) && lineItems.length > 0
      ? `\nLINE ITEMS:\n${lineItems.map((li: any, i: number) => `  ${i + 1}. "${li.description}" — qty: ${li.quantity}, unit: ${li.unit || 'ea'}, unit_price: ${li.unit_price}, subtotal: ${li.subtotal}`).join('\n')}\n`
      : '\nNo line items currently.\n';

    const prompt = `You are a professional proposal editor for contractors. A user has a proposal and wants the following revision. You can change text content, visual template style, financial settings, AND line items/pricing.

IMPORTANT RULES:
- Only change fields that the user's revision request actually asks for.
- Do NOT append text to special_conditions unless the user specifically asks to add a special condition.
- CRITICAL: If the user asks about cosmetic/visual changes (colors, logo size, layout, font, theme, design, look, appearance, style), use the appropriate field: template for overall style, logo_size for logo sizing, logo_position for logo placement. NEVER put cosmetic notes into text fields like special_conditions.
- Template options: classic, modern, minimal, bold, executive.
- Logo size options: small, medium, large. Logo position options: left, center, right.
- For pricing changes: you can modify line_items, tax_rate, deposit_mode, deposit_value. Recalculate all totals.
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
- Deposit Mode: ${proposal.deposit_mode || "percentage"}
- Deposit Value: ${proposal.deposit_value || 0}
- Tax Rate: ${proposal.tax_rate || 0}
- Subtotal: ${proposal.subtotal || 0}
- Total: ${proposal.total || 0}
- Logo Size: ${proposal.logo_size || "medium"}
- Logo Position: ${proposal.logo_position || "left"}
${lineItemsSummary}
Only return the fields that need to change.`;

    console.log(`[AI CALL] function: ${FN_NAME} | model: ${MODEL} | task: revision | tokens: ${MAX_TOKENS}`);

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
        system: "You revise contractor proposals based on user instructions. You can change text, visual template style, logo size/position, financial terms, and line items with pricing math. Return only the changed fields. NEVER put cosmetic/visual requests into text fields like special_conditions.",
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: "return_revised_proposal",
            description: "Return the revised proposal fields. Only include changed fields.",
            input_schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                template: { type: "string", enum: ["classic", "modern", "minimal", "bold", "executive"] },
                logo_size: { type: "string", enum: ["small", "medium", "large"] },
                logo_position: { type: "string", enum: ["left", "center", "right"] },
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
        ],
        tool_choice: { type: "tool", name: "return_revised_proposal" },
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
    const revised = toolUse ? toolUse.input : {};

    return new Response(JSON.stringify({ revised }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${e instanceof Error ? e.message : "unknown"}`);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
