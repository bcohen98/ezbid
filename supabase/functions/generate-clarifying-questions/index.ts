import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK = [
  "Any specific materials or brands required?",
  "What is your target start date?",
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trade, job_description, company_profile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const companyName = company_profile?.company_name || "contractor";
    const tradeType = company_profile?.trade_type || trade || "general";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a contractor proposal assistant. Based on the trade type, job description, and contractor context provided, generate exactly 2-3 short clarifying questions that would help produce a more accurate and complete proposal. Questions should be specific to THIS job — not generic. Do not ask what the contractor already told you. Do not ask for information already present in the job description. Return ONLY a JSON array of question strings, no other text. Example: [\"How many squares is the roof?\", \"Are you removing the existing shingles or overlaying?\"]",
          },
          {
            role: "user",
            content: `Trade: ${trade}\nJob description: ${job_description}\nContractor: ${companyName}, specializes in ${tradeType}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", response.status, await response.text());
      return new Response(JSON.stringify({ questions: FALLBACK }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    try {
      // Extract JSON array from response
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
    console.error("generate-clarifying-questions error:", e);
    return new Response(JSON.stringify({ questions: FALLBACK }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
