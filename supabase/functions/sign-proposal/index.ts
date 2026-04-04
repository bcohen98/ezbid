import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    // Validate proposal exists and token matches
    const { data: proposal, error: pErr } = await supabase
      .from("proposals")
      .select("id, status, signing_token")
      .eq("id", proposal_id)
      .eq("signing_token", signing_token)
      .single();

    if (pErr || !proposal) {
      console.error("[sign-proposal] Proposal lookup error:", pErr);
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

    // Decode base64 signature and upload
    const base64Data = signature_data.replace(/^data:image\/png;base64,/, "");
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `signing/${proposal_id}-${Date.now()}.png`;
    const { error: uploadErr } = await supabase.storage
      .from("signatures")
      .upload(fileName, bytes, { contentType: "image/png", upsert: true });

    if (uploadErr) {
      console.error("[sign-proposal] Upload error:", uploadErr);
      throw new Error(`Signature upload failed: ${uploadErr.message}`);
    }

    const { data: urlData, error: urlErr } = await supabase.storage
      .from("signatures")
      .createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10);
    if (urlErr) throw urlErr;

    // Update proposal (service role bypasses RLS)
    const { error: updateErr } = await supabase
      .from("proposals")
      .update({
        client_signature_url: urlData.signedUrl,
        client_signed_at: new Date().toISOString(),
        status: "signed",
      })
      .eq("id", proposal_id)
      .eq("signing_token", signing_token)
      .eq("status", "sent");

    if (updateErr) {
      console.error("[sign-proposal] Update error:", updateErr);
      throw new Error(`Proposal update failed: ${updateErr.message}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[sign-proposal] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
