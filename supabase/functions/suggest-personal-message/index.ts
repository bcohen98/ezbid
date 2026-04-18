// Generates a warm 2-3 sentence personal message the contractor can send with
// the proposal e-signature email. Uses Lovable AI Gateway (consistent with rest of project).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Always return 200 with a JSON body — never a non-2xx — so the client can read errors.
  try {
    const { contractor_name, client_name, trade, scope_summary } = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      console.error("LOVABLE_API_KEY missing");
      return new Response(JSON.stringify({ ok: false, message: "", error: "LOVABLE_API_KEY not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tradeLabel = String(trade || "general contractor").replace(/_/g, " ");
    const system = `You are a friendly ${tradeLabel} writing a brief, warm note to a homeowner. Maximum 2-3 sentences. Plain text only — no markdown, no quotes. Sound like a real person, not a corporate template.`;
    const user = `Write a short personal message (2-3 sentences max) from ${contractor_name || "the contractor"} to ${client_name || "the client"} that will go above the proposal link in an email. Reference what the proposal is for in one short phrase. Be warm, professional, confident.

Trade: ${tradeLabel}
Scope summary: ${(scope_summary || "the work we discussed").slice(0, 400)}

Write only the message body — no subject, no signature, no quotes.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 200,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("Lovable AI error:", res.status, t);
      return new Response(JSON.stringify({ ok: false, message: "", error: `AI ${res.status}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const message = (data?.choices?.[0]?.message?.content || "").trim();
    return new Response(JSON.stringify({ ok: true, message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-personal-message UNHANDLED:", e);
    return new Response(JSON.stringify({ ok: false, message: "", error: e instanceof Error ? e.message : "unknown" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
