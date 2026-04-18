// Generates a warm 2-3 sentence personal message the contractor can send with
// the proposal e-signature email. Uses Anthropic directly per architectural decision.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contractor_name, client_name, trade, scope_summary } = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const system = `You are a friendly ${(trade || "general contractor").replace(/_/g, " ")} writing a brief, warm note to a homeowner. Maximum 2-3 sentences. Plain text only — no markdown, no greetings like "Hi" if no client name was provided. Sound like a real person, not a corporate template.`;

    const user = `Write a short personal message (2-3 sentences max) from ${contractor_name || "the contractor"} to ${client_name || "the client"} that will go above the proposal link in an email. Reference what the proposal is for in one short phrase. Be warm, professional, confident.

Trade: ${trade || "general work"}
Scope summary: ${(scope_summary || "the work we discussed").slice(0, 400)}

Write only the message body — no subject, no signature, no quotes.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 200,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error("Anthropic error:", res.status, t);
      throw new Error("Anthropic gateway error");
    }
    const data = await res.json();
    const message = (data?.content?.[0]?.text || "").trim();

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-personal-message error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", message: "" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
