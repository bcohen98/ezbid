import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /slurp/i, /mediapartners/i,
  /googlebot/i, /bingbot/i, /yandex/i, /baidu/i, /duckduckbot/i,
  /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /whatsapp/i, /telegrambot/i, /discordbot/i,
  /semrush/i, /ahrefs/i, /mj12bot/i, /dotbot/i,
  /uptimerobot/i, /pingdom/i, /headlesschrome/i, /phantomjs/i,
  /lighthouse/i, /chrome-lighthouse/i, /pagespeed/i,
];

function isBot(ua: string): boolean {
  if (!ua) return true;
  return BOT_PATTERNS.some((p) => p.test(ua));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userAgent = req.headers.get("user-agent") || "";
    if (isBot(userAgent)) {
      return new Response(JSON.stringify({ ok: true, skipped: "bot" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { page_url, session_id, visitor_id, is_logged_in, user_id, is_guest_proposal_start, is_guest_proposal_complete } = body;

    if (!page_url) {
      return new Response(JSON.stringify({ error: "page_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract IP from headers (Supabase/Cloudflare forwards)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    await client.from("site_analytics").insert({
      ip_address: ip,
      page_url,
      session_id: session_id || null,
      visitor_id: visitor_id || null,
      is_logged_in: is_logged_in || false,
      user_id: user_id || null,
      is_guest_proposal_start: is_guest_proposal_start || false,
      is_guest_proposal_complete: is_guest_proposal_complete || false,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("log-visit error:", error);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
