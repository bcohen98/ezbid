import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MODEL: claude-haiku-4-5-20251001 — short helpful chat answers, not in core list
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;
const FN_NAME = "help-chat";

const SYSTEM_PROMPT = `You are the EZ-Bid Help Assistant — a friendly, concise guide for contractors using the EZ-Bid proposal platform.

EZ-Bid helps contractors create, send, and manage professional proposals. Here's what you know about the app:

**Navigation & Pages:**
- **Dashboard** (/dashboard) — Overview of all proposals with status badges, search, sort, and quick stats.
- **New Proposal** (/proposals/new) — Select a template, fill in client info, job details, line items, pricing, terms.
- **Proposal Preview** (/proposals/:id/preview) — Live preview. Side panel for AI revisions, exhibits, PDF, email.
- **Proposal Detail** (/proposals/:id) — View summary, client info, line items, exhibits.
- **Clients** (/clients) — Manage your client list.
- **Company Profile** (/company-profile) — Set up your company name, logo, address, license, defaults.

**Key Features:**
- Templates: classic, modern, minimal, bold, executive, contractor, premium, clean
- AI Polish: Enhances job description and scope of work
- AI Revision: Describe changes in plain English
- Exhibits, PDF, Email, E-Signature
- Subscription: Free tier 3 proposals, then Pro ($29/mo)

Keep answers short (2-3 sentences max). Use bullet points for multi-step instructions.`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

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

    const { messages } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    console.log(`[AI CALL] function: ${FN_NAME} | model: ${MODEL} | task: chat | tokens: ${MAX_TOKENS}`);

    // Anthropic streaming via SSE
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
        system: SYSTEM_PROMPT,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${response.status} ${t.slice(0, 300)}`);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI service unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Translate Anthropic SSE to OpenAI-style SSE chunks the client expects
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        let inputTokens = 0;
        let outputTokens = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const dataStr = line.slice(5).trim();
              if (!dataStr) continue;
              try {
                const evt = JSON.parse(dataStr);
                if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                  const chunk = {
                    choices: [{ delta: { content: evt.delta.text } }],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                } else if (evt.type === "message_start") {
                  inputTokens = evt.message?.usage?.input_tokens || 0;
                } else if (evt.type === "message_delta") {
                  outputTokens = evt.usage?.output_tokens || outputTokens;
                }
              } catch { /* skip */ }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          console.log(`[AI RESPONSE] function: ${FN_NAME} | model: ${MODEL} | tokens_used: ${inputTokens} in / ${outputTokens} out | status: success`);
        } catch (err) {
          console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: stream ${err}`);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${e instanceof Error ? e.message : "unknown"}`);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
