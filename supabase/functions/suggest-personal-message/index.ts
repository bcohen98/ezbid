// Generates a warm 2-3 sentence personal message the contractor can send with
// the proposal e-signature email.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MODEL: claude-haiku-4-5-20251001 — short structured email output, no complex reasoning needed
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;
const FN_NAME = "suggest-personal-message";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Always return 200 with a JSON body so the client can read errors.
  try {
    const { contractor_name, company_name, client_name, job_title, trade, scope_summary } = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ANTHROPIC_API_KEY missing`);
      return new Response(JSON.stringify({ ok: false, message: "", error: "ANTHROPIC_API_KEY not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tradeLabel = String(trade || "general contractor").replace(/_/g, " ");
    const firstName = String(client_name || "").trim().split(/\s+/)[0] || "";
    const greetingHint = firstName ? `"Hello ${firstName},"` : `"Hello,"`;
    const signoff = (company_name || contractor_name || "").trim();
    const jobLabel = (job_title || scope_summary || "your project").trim();

    const system = `You are a professional ${tradeLabel} writing a polished cover-letter email to a potential customer that will accompany a formal written proposal. Tone: confident, courteous, professional but warm — like a respected tradesperson, not a marketing pitch. Plain text only — no markdown, no quotes, no emojis, no exclamation points. Write 3-4 short paragraphs. Always include greeting and signoff.`;

    const user = `Write a professional cover-letter email body that will appear ABOVE the proposal link.

Structure (follow exactly):
1. Greeting line — start with ${greetingHint}.
2. Opening — thank the customer for the opportunity to bid on the work. Reference what the project is in one short phrase (e.g. "${jobLabel}").
3. What's included — one sentence telling them the attached proposal contains the detailed scope of work, materials, pricing, timeline, and warranty for their review.
4. Call to action — invite them to review it and reply with any questions, and to use the link in the email when ready to sign electronically.
5. Signoff — a short closing line followed by "${signoff || "Your contractor"}" on its own line.

Constraints:
- 90 to 160 words total.
- Plain text only. No markdown, no bullet lists, no headings.
- No emojis, no exclamation points, no "!", no "Cheers", no "Best!".
- Do NOT include subject line or "Sent from..." footer.
- Do NOT mention pricing numbers — they're in the proposal itself.

Trade: ${tradeLabel}
Project: ${jobLabel}
Customer: ${client_name || "the customer"}
Contractor / company name: ${signoff || contractor_name || "the contractor"}
Brief scope context: ${(scope_summary || "").slice(0, 600)}

Write only the email body.`;

    console.log(`[AI CALL] function: ${FN_NAME} | model: ${MODEL} | task: message | tokens: ${MAX_TOKENS}`);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${res.status} ${t.slice(0, 300)}`);
      return new Response(JSON.stringify({ ok: false, message: "", error: `Anthropic ${res.status}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    console.log(`[AI RESPONSE] function: ${FN_NAME} | model: ${MODEL} | tokens_used: ${data?.usage?.input_tokens ?? "?"} in / ${data?.usage?.output_tokens ?? "?"} out | status: success`);
    const message = ((data.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("") || "").trim();
    return new Response(JSON.stringify({ ok: true, message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${e instanceof Error ? e.message : "unknown"}`);
    return new Response(JSON.stringify({ ok: false, message: "", error: e instanceof Error ? e.message : "unknown" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
