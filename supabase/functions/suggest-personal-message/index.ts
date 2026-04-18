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
    const { contractor_name, client_name, trade, scope_summary } = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ANTHROPIC_API_KEY missing`);
      return new Response(JSON.stringify({ ok: false, message: "", error: "ANTHROPIC_API_KEY not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tradeLabel = String(trade || "general contractor").replace(/_/g, " ");
    const system = `You are a friendly ${tradeLabel} writing a brief, warm note to a homeowner. Maximum 2-3 sentences. Plain text only — no markdown, no quotes. Sound like a real person, not a corporate template.`;
    const user = `Write a short personal message (2-3 sentences max) from ${contractor_name || "the contractor"} to ${client_name || "the client"} that will go above the proposal link in an email. Reference what the proposal is for in one short phrase. Be warm, professional, confident.

Trade: ${tradeLabel}
Scope summary: ${(scope_summary || "the work we discussed").slice(0, 400)}

Write only the message body — no subject, no signature, no quotes.`;

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
