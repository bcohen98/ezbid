import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── SENDER ADDRESS ───────────────────────────────────────────────
// TEMPORARY: Using Resend sandbox sender for testing.
// Once ez.bid domain is verified in Resend, swap this to:
//   const FROM_ADDRESS = "EZ-Bid <proposals@ez.bid>";
const FROM_ADDRESS = "EZ-Bid <onboarding@resend.dev>";
// ──────────────────────────────────────────────────────────────────

const RESEND_API = "https://api.resend.com/emails";

interface ResendPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

const SANDBOX_FROM_ADDRESS = "onboarding@resend.dev";

function isSandboxSender(fromAddress: string) {
  return fromAddress.includes(SANDBOX_FROM_ADDRESS);
}

function createErrorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendEmail(apiKey: string, payload: ResendPayload) {
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("[Resend error]", res.status, JSON.stringify(body));
    throw new Error(`Resend API error (${res.status}): ${body?.message || JSON.stringify(body)}`);
  }
  console.log("[Resend success]", JSON.stringify(body));
  return body;
}

function selfEmailHtml(
  companyName: string,
  clientName: string,
  proposalNumber: string,
  jobTitle: string,
  total: string,
  proposalUrl: string,
) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#1a1a1a;padding:24px 32px;">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">EZ-Bid</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#1a1a1a;">Your proposal is ready</h2>
      <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 24px;">
        Your proposal for <strong>${clientName}</strong> is ready to review.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr><td style="padding:8px 0;color:#71717a;font-size:13px;">Proposal #</td><td style="padding:8px 0;text-align:right;font-size:13px;font-weight:600;color:#1a1a1a;">${proposalNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a;font-size:13px;border-top:1px solid #f4f4f5;">Job Title</td><td style="padding:8px 0;text-align:right;font-size:13px;font-weight:600;color:#1a1a1a;border-top:1px solid #f4f4f5;">${jobTitle}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a;font-size:13px;border-top:1px solid #f4f4f5;">Total</td><td style="padding:8px 0;text-align:right;font-size:13px;font-weight:600;color:#1a1a1a;border-top:1px solid #f4f4f5;">${total}</td></tr>
      </table>
      <a href="${proposalUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
        View Proposal
      </a>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
      <p style="margin:0;font-size:12px;color:#a1a1aa;">Powered by EZ-Bid</p>
    </div>
  </div>
</body>
</html>`;
}

function clientEmailHtml(
  companyName: string,
  ownerName: string,
  logoUrl: string | null,
  proposalNumber: string,
  jobTitle: string,
  total: string,
  signUrl: string,
) {
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:40px;max-width:180px;"/>`
    : `<span style="font-size:18px;font-weight:700;color:#1a1a1a;">${companyName}</span>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="padding:24px 32px;border-bottom:1px solid #e4e4e7;">
      ${logoBlock}
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#1a1a1a;">You have a new proposal</h2>
      <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 24px;">
        <strong>${ownerName || companyName}</strong> has sent you a proposal for <strong>${jobTitle}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr><td style="padding:8px 0;color:#71717a;font-size:13px;">Proposal #</td><td style="padding:8px 0;text-align:right;font-size:13px;font-weight:600;color:#1a1a1a;">${proposalNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#71717a;font-size:13px;border-top:1px solid #f4f4f5;">Total</td><td style="padding:8px 0;text-align:right;font-size:13px;font-weight:600;color:#1a1a1a;border-top:1px solid #f4f4f5;">${total}</td></tr>
      </table>
      <a href="${signUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
        Review &amp; Sign Proposal
      </a>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
      <p style="margin:0;font-size:12px;color:#a1a1aa;">Powered by EZ-Bid</p>
    </div>
  </div>
</body>
</html>`;
}

function confirmationEmailHtml(clientName: string, clientEmail: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#1a1a1a;padding:24px 32px;">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">EZ-Bid</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#1a1a1a;">Proposal sent</h2>
      <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0;">
        Your proposal has been delivered to <strong>${clientName}</strong> at <strong>${clientEmail}</strong>.
      </p>
    </div>
    <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
      <p style="margin:0;font-size:12px;color:#a1a1aa;">Powered by EZ-Bid</p>
    </div>
  </div>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured. Add it in project secrets.");
    }

    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // ── Request body ──
    const { proposal_id, send_to_self } = await req.json();
    if (!proposal_id) throw new Error("Missing proposal_id");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // ── Fetch proposal ──
    const { data: proposal, error: pErr } = await supabaseAdmin
      .from("proposals")
      .select("*")
      .eq("id", proposal_id)
      .eq("user_id", user.id)
      .single();
    if (pErr || !proposal) throw new Error("Proposal not found");

    // ── Fetch company profile ──
    const { data: profile } = await supabaseAdmin
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const companyName = profile?.company_name || "Your Contractor";
    const ownerName = profile?.owner_name || "";
    const contractorEmail = profile?.email || user.email!;
    const logoUrl = profile?.logo_url || null;

    const proposalNumber = `PRO-${String(proposal.proposal_number || 0).padStart(4, "0")}`;
    const jobTitle = proposal.title || "Untitled";
    const clientName = proposal.client_name || "Client";
    const clientEmail = proposal.client_email;
    const total = `$${Number(proposal.total || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

    const origin = req.headers.get("origin") || "https://ez.bid";

    // ── SCENARIO A: Send to self ──
    if (send_to_self) {
      const proposalUrl = `${origin}/proposals/${proposal_id}`;
      console.log(`[send-proposal-email] Scenario A: sending to contractor ${contractorEmail}`);

      await sendEmail(RESEND_API_KEY, {
        from: FROM_ADDRESS,
        to: [contractorEmail],
        subject: `Your EZ-Bid Proposal is Ready — ${jobTitle}`,
        html: selfEmailHtml(companyName, clientName, proposalNumber, jobTitle, total, proposalUrl),
      });

      return new Response(JSON.stringify({
        success: true,
        message: `Proposal sent to ${contractorEmail}`,
        recipient: contractorEmail,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SCENARIO B: Send to client for e-signature ──
    if (!clientEmail) throw new Error("Client email is required to send proposal");

    const signUrl = `${origin}/sign/${proposal_id}`;
    console.log(`[send-proposal-email] Scenario B: sending to client ${clientEmail}`);

    // 1) Email to client
    await sendEmail(RESEND_API_KEY, {
      from: FROM_ADDRESS,
      to: [clientEmail],
      subject: `${companyName} sent you a proposal`,
      html: clientEmailHtml(companyName, ownerName, logoUrl, proposalNumber, jobTitle, total, signUrl),
    });

    // 2) Confirmation email to contractor
    console.log(`[send-proposal-email] Sending confirmation to contractor ${contractorEmail}`);
    await sendEmail(RESEND_API_KEY, {
      from: FROM_ADDRESS,
      to: [contractorEmail],
      subject: `Proposal sent to ${clientName}`,
      html: confirmationEmailHtml(clientName, clientEmail),
    });

    // 3) Update proposal status
    const { error: updateErr } = await supabaseAdmin
      .from("proposals")
      .update({ status: "sent", sent_at: new Date().toISOString(), delivery_method: "email_client" })
      .eq("id", proposal_id);
    if (updateErr) console.error("[send-proposal-email] Failed to update proposal status:", updateErr);

    return new Response(JSON.stringify({
      success: true,
      message: `Proposal sent to client at ${clientEmail}`,
      recipient: clientEmail,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[send-proposal-email] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
