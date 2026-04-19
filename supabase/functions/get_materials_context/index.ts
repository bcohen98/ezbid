import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Catalog temporarily disabled — Claude estimation active
  // Re-enable when Home Depot live pricing is ready
  return new Response(JSON.stringify({ materials: [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
