import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { proposal_id, signing_token, signature_data } = await req.json();

    if (!proposal_id || !signing_token) {
      return new Response(JSON.stringify({ error: "Missing proposal_id or signing_token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!signature_data) {
      return new Response(JSON.stringify({ error: "Missing signature_data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: proposal, error: proposalError } = await supabase
      .from("proposals")
      .select("id, status")
      .eq("id", proposal_id)
      .eq("signing_token", signing_token)
      .single();

    if (proposalError || !proposal) {
      console.error("[sign-proposal] Proposal lookup error:", proposalError);
      return new Response(JSON.stringify({ error: "Invalid proposal or token" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (proposal.status !== "sent") {
      return new Response(JSON.stringify({ error: "Proposal is not in a signable state" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: signedProposal, error: signError } = await supabase
      .from("proposals")
      .update({
        client_signature_url: signature_data,
        client_signed_at: new Date().toISOString(),
        status: "signed",
      })
      .eq("id", proposal_id)
      .eq("signing_token", signing_token)
      .eq("status", "sent")
      .select("id")
      .maybeSingle();

    if (signError) {
      console.error("[sign-proposal] Update error:", signError);
      throw new Error(`Proposal signing failed: ${signError.message}`);
    }

    if (!signedProposal) {
      return new Response(JSON.stringify({ error: "Proposal is no longer available for signing" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("[sign-proposal] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
