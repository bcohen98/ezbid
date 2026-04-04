import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the EZ-Bid Help Assistant — a friendly, concise guide for contractors using the EZ-Bid proposal platform.

EZ-Bid helps contractors create, send, and manage professional proposals. Here's what you know about the app:

**Navigation & Pages:**
- **Dashboard** (/dashboard) — Overview of all proposals with status badges, search, sort, and quick stats. Click any proposal to see details.
- **New Proposal** (/proposals/new) — Start by selecting a template, then fill in client info, job details, line items, pricing, terms, and delivery method. You can "Polish with AI" to enhance the text.
- **Proposal Preview** (/proposals/:id/preview) — See a live preview. Use the side panel for AI revisions, uploading exhibits/attachments, downloading PDF, or sending to client via email.
- **Proposal Detail** (/proposals/:id) — View proposal summary, client info, line items, exhibits. Duplicate, resend, or edit from here.
- **Clients** (/clients) — Manage your client list (add, edit, delete).
- **Company Profile** (/company-profile) — Set up your company name, logo, address, license numbers, trade type, default warranty, payment terms, and disclosures.
- **Signing** — After sending, clients get a link to review and e-sign. Once signed, you'll see a "Countersign Required" badge — click it to add your countersignature.

**Key Features:**
- Templates: classic, modern, minimal, bold, executive, contractor, premium, clean
- AI Polish: Enhances job description and scope of work text
- AI Revision: In preview, describe changes in plain English and AI updates the proposal
- Exhibits: Upload photos, diagrams, or documents to attach to proposals
- PDF Download: Generate and download proposals as PDF
- Email: Send proposals to yourself or directly to clients for e-signature
- E-Signature: Clients sign on their device; contractors countersign in-app
- Subscription: Free tier includes 3 proposals, then upgrade to Pro ($29/mo)

**Tips:**
- Complete your Company Profile first — it auto-fills into every proposal
- Use "Polish with AI" before sending for more professional language
- The proposal form auto-saves drafts to local storage
- You can edit fields directly on the preview by clicking the pencil icons

Keep answers short (2-3 sentences max). Use bullet points for multi-step instructions. If unsure, suggest checking the relevant page.`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("help-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
