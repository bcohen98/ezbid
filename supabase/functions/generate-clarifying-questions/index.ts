import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// MODEL: claude-haiku-4-5-20251001 — short structured task, not in core list
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 1024;
const FN_NAME = "generate-clarifying-questions";

const FALLBACK = [
  "Any specific materials or brands required?",
  "What is your target start date?",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trade, job_description, company_profile, user_context } = await req.json();
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const companyName = company_profile?.company_name || "contractor";
    const tradeType = company_profile?.trade_type || trade || "general";

    const priorityClause = user_context?.clarifying_question_priorities?.length
      ? ` PRIORITY TOPICS based on this contractor's history (ask about these first if relevant): ${user_context.clarifying_question_priorities.join(", ")}.`
      : "";

    console.log(`[AI CALL] function: ${FN_NAME} | model: ${MODEL} | task: clarify | tokens: ${MAX_TOKENS}`);

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
        system: `You are a contractor proposal assistant. Based on the trade type, job description, and contractor context provided, generate exactly 2-3 short clarifying questions that would help produce a more accurate and complete proposal. Questions should be specific to THIS job — not generic. Do not ask what the contractor already told you.${priorityClause} Return ONLY a JSON array of question strings, no other text. Example: ["How many squares is the roof?", "Are you removing the existing shingles or overlaying?"]`,
        messages: [{
          role: "user",
          content: `Trade: ${trade}\nJob description: ${job_description}\nContractor: ${companyName}, specializes in ${tradeType}`,
        }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${response.status} ${t.slice(0, 300)}`);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ questions: FALLBACK }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    console.log(`[AI RESPONSE] function: ${FN_NAME} | model: ${MODEL} | tokens_used: ${aiData?.usage?.input_tokens ?? "?"} in / ${aiData?.usage?.output_tokens ?? "?"} out | status: success`);
    const content = (aiData.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("") || "";

    try {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const questions = JSON.parse(match[0]);
        if (Array.isArray(questions) && questions.length > 0) {
          return new Response(JSON.stringify({ questions: questions.slice(0, 3) }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } catch {
      console.error("Failed to parse AI response:", content);
    }

    return new Response(JSON.stringify({ questions: FALLBACK }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[AI ERROR] function: ${FN_NAME} | model: ${MODEL} | error: ${e instanceof Error ? e.message : "unknown"}`);
    return new Response(JSON.stringify({ questions: FALLBACK }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
