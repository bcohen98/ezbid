import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MODEL: claude-sonnet-4-20250514 — main proposal narrative & scope of work generation (core product, complex writing quality critical)
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 4096;
const FN_NAME = "generate-proposal";

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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

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

    const profileDirectives: string[] = [];
    if (company?.default_warranty) profileDirectives.push(`WARRANTY: Use this exact warranty language verbatim from the contractor's profile, do not paraphrase or replace it: """${company.default_warranty}"""`);
    if (company?.default_payment_terms) profileDirectives.push(`PAYMENT TERMS: Use this exact payment terms language verbatim from the contractor's profile as the foundation, then append the specific deposit/balance dollar amounts for this job: """${company.default_payment_terms}"""`);
    if (company?.default_disclosures) profileDirectives.push(`DISCLOSURES: Use this exact disclosure language verbatim from the contractor's profile: """${company.default_disclosures}"""`);
    if (company?.insurance_info) profileDirectives.push(`INSURANCE: Reference this insurance information from the contractor's profile where appropriate: """${company.insurance_info}"""`);
    if ((company?.license_numbers || []).length) profileDirectives.push(`LICENSES: Reference these license numbers in the proposal where appropriate: ${(company.license_numbers || []).join(", ")}`);
    if (company?.default_deposit_percentage != null && !deposit_label) profileDirectives.push(`DEPOSIT: Default deposit is ${company.default_deposit_percentage}% of grand total — use this in the payment terms.`);

    const systemPrompt = `You are generating a professional contractor proposal. Your job is to write a scope of work that EXACTLY matches the line items provided. Do not invent, add, or imply any work, materials, or services that are not present in the line items.

STRICT RULES:
1. The scope of work must be derived only from what the user described and the line items they entered. Nothing more.
2. If the job is small (hedge trimming, rose bed installation, touch-up painting, one fixture swap), write a short, proportionate proposal. Do not pad it.
3. Match the tone and scale to the job. A $400 job should read like a $400 job — professional, clear, and brief. A $25,000 job gets more detail.
4. Use the actual line item descriptions in the scope of work. Reference specific quantities, materials, and tasks as entered by the user.
5. Never hallucinate materials, scope, or services not in the line items.
6. Price totals in the proposal must match the grand total from the line item table exactly.
7. If the user's description and line items conflict, trust the line items.
8. CONTRACTOR PROFILE OVERRIDES: When the contractor has provided their own warranty, payment terms, or disclosures in their profile (see directives below), you MUST use that exact language verbatim — do not generate generic boilerplate. Only generate generic content for sections where no profile language was provided.

${profileDirectives.length ? `CONTRACTOR PROFILE DIRECTIVES (highest priority — use verbatim):\n${profileDirectives.join("\n")}\n\n` : ""}Return structured proposal data using the provided tool.${user_context?.contractor_insights?.length ? ` Contractor profile insights: ${user_context.contractor_insights.join(". ")}` : ""}${user_context?.pricing_personality ? ` This contractor's pricing personality is "${user_context.pricing_personality}" with ${user_context.pricing_confidence || "medium"} consistency.` : ""}${(materials_context && Array.isArray(materials_context) && materials_context.length > 0 && job_state) ? `\n\nYou have access to current market pricing data for ${tradeLabel} contractors in ${job_state}. CURRENT MATERIALS PRICING DATA:\n${JSON.stringify(materials_context)}` : ""}`;

    console.log(`[AI CALL] function: ${FN_NAME} | model: ${MODEL} | task: proposal | tokens: ${MAX_TOKENS}`);

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
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: "return_proposal",
            description: "Return the generated proposal sections",
            input_schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                cover_letter: { type: "string" },
                scope_of_work: { type: "string" },
                materials_included: { type: "string" },
                materials_excluded: { type: "string" },
                project_timeline: { type: "string" },
                warranty_terms: { type: "string" },
                payment_terms: { type: "string" },
                special_conditions: { type: "string" },
                disclosures: { type: "string" },
              },
              required: ["title", "cover_letter", "scope_of_work", "materials_included", "project_timeline", "warranty_terms", "payment_terms"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "return_proposal" },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${response.status} ${t.slice(0, 300)}`);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Anthropic API error");
    }

    const data = await response.json();
    console.log(`[AI RESPONSE] function: ${FN_NAME} | model: ${MODEL} | tokens_used: ${data?.usage?.input_tokens ?? "?"} in / ${data?.usage?.output_tokens ?? "?"} out | status: success`);

    const toolUse = (data.content || []).find((c: any) => c.type === "tool_use");
    if (!toolUse) throw new Error("No proposal content returned from AI");
    const result = toolUse.input;

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${e instanceof Error ? e.message : "unknown"}`);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
