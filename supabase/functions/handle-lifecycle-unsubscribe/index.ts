import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const uid = url.searchParams.get("uid");

    if (!uid) {
      return new Response(
        JSON.stringify({ error: "Missing uid parameter" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Upsert unsubscribe record
    const { error } = await supabase
      .from("lifecycle_email_unsubs")
      .upsert({ user_id: uid }, { onConflict: "user_id" });

    if (error) {
      console.error("[handle-lifecycle-unsubscribe] Error:", error.message);
      throw error;
    }

    console.log(`[handle-lifecycle-unsubscribe] User ${uid} unsubscribed`);

    // Return a simple HTML page
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed — EZ-Bid</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa;color:#1a1a1a}
.card{text-align:center;padding:3rem;max-width:400px}h1{font-size:1.25rem;margin-bottom:.5rem}p{color:#666;font-size:.9rem;line-height:1.5}</style>
</head>
<body><div class="card"><h1>You've been unsubscribed</h1><p>You won't receive any more lifecycle emails from EZ-Bid. You'll still get important account emails like proposal notifications.</p></div></body>
</html>`;

    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
