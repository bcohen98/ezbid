import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const tradeSections: Record<string, string> = {
  roofing: "scope of work, materials list with line items, labor, project timeline, warranty details, payment terms",
  landscaping: "scope of work, services checklist, materials and plants, project timeline, maintenance notes, payment terms",
  hvac: "scope of work, equipment specifications, parts and labor breakdown, project timeline, warranty, payment terms",
  plumbing: "scope of work, parts and labor breakdown, project timeline, warranty, payment terms",
  electrical: "scope of work, equipment and materials list, labor, permit notes, project timeline, payment terms",
  painting: "scope of work, surfaces to be painted, materials and finish details, number of coats, project timeline, payment terms",
  general_contractor: "scope of work, materials and labor breakdown, subcontractor notes, project timeline, payment terms",
  pressure_washing: "scope of work, surfaces to be cleaned, cleaning agents and equipment, project timeline, payment terms",
  foundation: "scope of work, site preparation details, materials and structural specifications, excavation and concrete details, waterproofing notes, project timeline, warranty, permit notes, payment terms",
  flooring: "scope of work, flooring material and finish details, subfloor preparation notes, removal and disposal of existing flooring, installation method, project timeline, warranty, payment terms",
  cabinetry: "scope of work, cabinet specifications and dimensions, hardware and finish details, countertop materials, removal of existing cabinetry, installation method, project timeline, warranty, payment terms",
  carpentry: "scope of work, lumber and materials list, joinery and structural details, finish specifications, project timeline, warranty, payment terms",
  masonry: "scope of work, brick or stone specifications, mortar and structural details, foundation preparation, scaffolding notes, project timeline, warranty, payment terms",
  asphalt: "scope of work, surface preparation and grading, asphalt mix specifications, base layer details, compaction and finishing, sealcoat and striping, equipment list, project timeline, warranty, payment terms",
  concrete: "scope of work, concrete mix specifications, forming and rebar details, gravel base preparation, pouring and finishing method, curing notes, project timeline, warranty, payment terms",
  other: "scope of work, materials and labor breakdown, project timeline, payment terms",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth is optional for guest proposals
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

    const { trade, client_name, job_address, job_description, line_items, subtotal, tax_amount, discount_amount, grand_total, deposit_amount, deposit_label, balance_due, company, user_context, smart_defaults, signature_line_items, job_state, materials_context } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const tradeLabel = (trade || "general_contractor").replace(/_/g, " ");
    const sections = tradeSections[trade] || tradeSections.other;

    const lineItemsText = (line_items || []).map((li: any, i: number) =>
      `${i + 1}. ${li.description} — ${li.quantity} ${li.unit} @ $${li.unit_price.toFixed(2)} = $${(li.quantity * li.unit_price).toFixed(2)}`
    ).join("\n");

    const depositSection = deposit_label
      ? `\n- Deposit Due Upon Signing: $${(deposit_amount || 0).toFixed(2)} (${deposit_label})\n- Balance Due Upon Completion: $${(balance_due || 0).toFixed(2)}`
      : "";

    const prompt = `You are an experienced ${tradeLabel} contractor writing a professional proposal. Generate a complete, ready-to-send proposal with these requirements:

COMPANY INFO:
- Company: ${company?.company_name || "N/A"}
- Owner: ${company?.owner_name || "N/A"}
- Phone: ${company?.phone || "N/A"}
- Email: ${company?.email || "N/A"}
- Address: ${[company?.street_address, company?.city, company?.state, company?.zip].filter(Boolean).join(", ") || "N/A"}
- License: ${(company?.license_numbers || []).join(", ") || "N/A"}

CLIENT: ${client_name || "N/A"}
JOB SITE: ${job_address || "N/A"}
JOB DESCRIPTION: ${job_description || "N/A"}

LINE ITEMS:
${lineItemsText || "None provided"}

FINANCIALS:
- Subtotal: $${(subtotal || 0).toFixed(2)}
- Tax: $${(tax_amount || 0).toFixed(2)}
- Discount: $${(discount_amount || 0).toFixed(2)}
- Grand Total: $${(grand_total || 0).toFixed(2)}${depositSection}

REQUIRED SECTIONS for ${tradeLabel}: cover letter, ${sections}, itemized quote table, grand total, signature line

RULES:
1. The scope of work MUST reference the actual line items — what is being done and the materials listed. The written proposal must match the quote exactly.
2. Use professional but plain language that sounds like an experienced ${tradeLabel} contractor — NOT generic corporate language.
3. Include the exact financial figures from the line items.
4. Write a brief professional cover letter addressed to the client.
5. Include realistic warranty terms and payment terms appropriate for ${tradeLabel} work.
6. Do NOT invent additional costs or items not in the line items.
7. The proposal should be ready to send — no placeholders.
8. NEVER use bracket placeholders like [Number], [Percentage], [Payment Methods], [Timeline], [Date], [Company], etc. Every value must be filled in with a real number, a sensible default, or omitted entirely. For example write "50% deposit required" not "[Percentage]% deposit required". Write "2-3 weeks" not "[Timeline]".
9. For scope_of_work, materials_included, and materials_excluded: format each item as a markdown bullet point using "- " prefix (one item per line). Do NOT use prose paragraphs for these three sections — use a bulleted list only.
10. For all OTHER sections (cover_letter, warranty_terms, payment_terms, disclosures, special_conditions, project_timeline): write in plain prose paragraphs. Do NOT use markdown bullet points, **bold**, or *italic* in these sections.${deposit_label ? `\n11. The payment terms section MUST include the deposit/balance breakdown: deposit of $${(deposit_amount || 0).toFixed(2)} due upon signing, balance of $${(balance_due || 0).toFixed(2)} due upon completion.` : ""}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You are an expert proposal writer for trade contractors. Return structured proposal data using the provided tool.${user_context?.contractor_insights?.length ? ` Contractor profile insights: ${user_context.contractor_insights.join(". ")}` : ""}${user_context?.pricing_personality ? ` This contractor's pricing personality is "${user_context.pricing_personality}" with ${user_context.pricing_confidence || "medium"} consistency.` : ""}${(materials_context && Array.isArray(materials_context) && materials_context.length > 0 && job_state) ? `\n\nYou have access to current market pricing data for ${tradeLabel} contractors in ${job_state}. This data is sourced from real supplier and market pricing updated regularly.\n\nCURRENT MATERIALS PRICING DATA:\n${JSON.stringify(materials_context)}\n\nPRICING INSTRUCTIONS:\n- When a material in your line item suggestions matches or closely matches something in the pricing data above, use its suggested_price field as your price — this is a single pre-calculated value, use it directly\n- Never return a price range in line item suggestions — always return one specific dollar amount per line item\n- For materials not found in the pricing data, estimate a realistic single price based on current market rates for ${job_state} using your training knowledge\n- For labor line items, estimate based on current regional labor rates for ${job_state}\n- Never return zero or blank for any price — every line item must have a specific dollar value\n- Do not apply any markup — return raw material and labor market rates only\n\nCRITICAL PRICING RULE: Each material in the pricing data includes a unit field. The suggested_price applies to exactly one of that unit. Examples: if unit is 'roll' then suggested_price is the price for one full roll — never divide it into per-foot pricing. If unit is 'piece' then suggested_price is per piece. If unit is 'square' then suggested_price is per roofing square (100 sq ft). If unit is 'bundle' then suggested_price is per bundle. Never decompose a unit price into a smaller sub-unit. Apply the unit exactly as specified — set the line item's unit field to match the catalog unit and quantity to the number of those units needed.` : ""}` },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_proposal",
              description: "Return the generated proposal sections",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Proposal title, e.g. 'Roof Replacement Proposal'" },
                  cover_letter: { type: "string", description: "Professional cover letter paragraph addressed to the client" },
                  scope_of_work: { type: "string", description: "Detailed scope of work as markdown bullet points (- item). One bullet per task or deliverable." },
                  materials_included: { type: "string", description: "Materials included as markdown bullet points (- item). One bullet per material." },
                  materials_excluded: { type: "string", description: "What is NOT included as markdown bullet points (- item). One bullet per exclusion." },
                  project_timeline: { type: "string", description: "Estimated timeline and schedule" },
                  warranty_terms: { type: "string", description: "Warranty details appropriate for the trade" },
                  payment_terms: { type: "string", description: "Payment schedule and terms" },
                  special_conditions: { type: "string", description: "Any special conditions, permits, or notes" },
                  disclosures: { type: "string", description: "Standard disclosures for the trade" },
                },
                required: ["title", "cover_letter", "scope_of_work", "materials_included", "project_timeline", "warranty_terms", "payment_terms"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_proposal" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No proposal content returned from AI");

    let result;
    try {
      result = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    } catch {
      throw new Error("Failed to parse AI response");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-proposal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
