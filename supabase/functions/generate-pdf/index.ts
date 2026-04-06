import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function esc(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmt(val: number | null | undefined): string {
  if (val == null) return '0.00';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface TradeStyle { headerBg: string; headerText: string; accentColor: string }

const TRADES: Record<string, TradeStyle> = {
  roofing:             { headerBg: '#2D3436', headerText: '#FFFFFF', accentColor: '#2D3436' },
  landscaping:         { headerBg: '#1B4332', headerText: '#FFFFFF', accentColor: '#1B4332' },
  hvac:                { headerBg: '#2C5F7C', headerText: '#FFFFFF', accentColor: '#2C5F7C' },
  plumbing:            { headerBg: '#1B2A4A', headerText: '#FFFFFF', accentColor: '#1B2A4A' },
  electrical:          { headerBg: '#92400E', headerText: '#FFFFFF', accentColor: '#92400E' },
  painting:            { headerBg: '#57534E', headerText: '#FFFFFF', accentColor: '#57534E' },
  general_contractor:  { headerBg: '#3E2723', headerText: '#FFFFFF', accentColor: '#3E2723' },
  pressure_washing:    { headerBg: '#475569', headerText: '#FFFFFF', accentColor: '#475569' },
  foundation:          { headerBg: '#6B7280', headerText: '#FFFFFF', accentColor: '#6B7280' },
  flooring:            { headerBg: '#78350F', headerText: '#FFFFFF', accentColor: '#78350F' },
  other:               { headerBg: '#374151', headerText: '#FFFFFF', accentColor: '#374151' },
};

function getStyle(trade: string | null): TradeStyle {
  return TRADES[trade || ''] || TRADES.other;
}

function buildHtml(proposal: any, lineItems: any[], profile: any, exhibits: any[]): string {
  const ts = getStyle(proposal.trade_type || profile?.trade_type);
  const companyName = esc(profile?.company_name) || 'Company Name';
  const address = [profile?.street_address, profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ');
  const contacts = [profile?.phone, profile?.email, profile?.website].filter(Boolean).map(esc).join(' &middot; ');

  const section = (title: string, content: string | null | undefined) => {
    if (!content) return '';
    return `
      <div style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="width:4px;height:16px;border-radius:2px;background:${ts.accentColor};"></div>
          <h3 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${ts.accentColor};margin:0;">${esc(title)}</h3>
        </div>
        <div style="margin-left:12px;font-size:13px;line-height:1.7;white-space:pre-wrap;">${esc(content)}</div>
      </div>`;
  };

  const lineItemsHtml = lineItems.length > 0 ? `
    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="width:4px;height:16px;border-radius:2px;background:${ts.accentColor};"></div>
        <h3 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${ts.accentColor};margin:0;">Pricing</h3>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:4px;">
        <thead>
          <tr style="background:${ts.accentColor}0D;">
            <th style="text-align:left;padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${ts.accentColor};">Description</th>
            <th style="text-align:right;padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${ts.accentColor};width:60px;">Qty</th>
            <th style="text-align:right;padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${ts.accentColor};width:60px;">Unit</th>
            <th style="text-align:right;padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${ts.accentColor};width:90px;">Unit Price</th>
            <th style="text-align:right;padding:10px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${ts.accentColor};width:90px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map((item, idx) => `
            <tr style="border-bottom:1px solid #f0f0f0;${idx % 2 === 1 ? 'background:#f9fafb;' : ''}">
              <td style="padding:10px 12px;">${esc(item.description)}</td>
              <td style="text-align:right;padding:10px 12px;">${item.quantity}</td>
              <td style="text-align:right;padding:10px 12px;">${esc(item.unit)}</td>
              <td style="text-align:right;padding:10px 12px;">$${fmt(item.unit_price)}</td>
              <td style="text-align:right;padding:10px 12px;font-weight:500;">$${fmt(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="border-top:2px solid ${ts.accentColor}33;padding-top:12px;font-size:13px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:4px 12px;color:#888;">Subtotal</td><td style="padding:4px 12px;text-align:right;">$${fmt(proposal.subtotal)}</td></tr>
          ${Number(proposal.tax_rate) > 0 ? `<tr><td style="padding:4px 12px;color:#888;">Tax (${proposal.tax_rate}%)</td><td style="padding:4px 12px;text-align:right;">$${fmt(proposal.tax_amount)}</td></tr>` : ''}
          <tr style="background:${ts.accentColor}0D;">
            <td style="padding:10px 12px;font-weight:700;font-size:15px;color:${ts.accentColor};border-radius:4px 0 0 4px;">Grand Total</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:15px;color:${ts.accentColor};border-radius:0 4px 4px 0;">$${fmt(proposal.total)}</td>
          </tr>
          ${Number(proposal.deposit_amount) > 0 ? `
            <tr><td style="padding:4px 12px;color:#888;">Deposit Due Upon Signing</td><td style="padding:4px 12px;text-align:right;">$${fmt(proposal.deposit_amount)}</td></tr>
            <tr style="font-weight:600;"><td style="padding:4px 12px;">Balance Due Upon Completion</td><td style="padding:4px 12px;text-align:right;">$${fmt(proposal.balance_due)}</td></tr>
          ` : ''}
        </table>
      </div>
    </div>` : '';

  let exhibitsHtml = '';
  if (exhibits.length > 0) {
    exhibitsHtml = `
    <div style="page-break-before:always;padding-top:40px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
        <div style="width:4px;height:16px;border-radius:2px;background:${ts.accentColor};"></div>
        <h3 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${ts.accentColor};margin:0;">Exhibits & Attachments</h3>
      </div>
      ${exhibits.map((ex, i) => `
        <div style="margin-bottom:16px;">
          <img src="${esc(ex.file_url)}" style="max-width:100%;max-height:500px;border:1px solid #e5e5e5;border-radius:4px;" />
          <p style="font-size:12px;color:#888;margin-top:4px;">${ex.caption ? esc(ex.caption) : `Exhibit ${i + 1}`}</p>
        </div>
      `).join('')}
    </div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',Arial,Helvetica,sans-serif; font-size:13px; color:#1a1a1a; background:#fff; }
  @page { size:letter; margin:0; }
</style></head><body>

<!-- Header -->
<div style="padding:24px 40px;background:${ts.headerBg};color:${ts.headerText};">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="vertical-align:top;width:60%;">
        ${profile?.logo_url ? `<img src="${esc(profile.logo_url)}" style="height:40px;margin-bottom:10px;filter:brightness(0) invert(1);" />` : ''}
        <div style="font-size:16px;font-weight:700;letter-spacing:-0.3px;">${companyName}</div>
        ${address ? `<div style="font-size:11px;opacity:0.8;margin-top:4px;">${esc(address)}</div>` : ''}
        <div style="font-size:11px;opacity:0.8;margin-top:2px;">${contacts}</div>
        ${profile?.license_numbers?.length ? `<div style="font-size:11px;opacity:0.7;margin-top:4px;">Lic# ${esc(profile.license_numbers.join(', '))}</div>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right;width:40%;">
        <div style="font-size:24px;font-weight:700;letter-spacing:-0.5px;">PROPOSAL</div>
        <div style="font-size:11px;opacity:0.7;margin-top:4px;">PRO-${String(proposal.proposal_number).padStart(4, '0')}</div>
      </td>
    </tr>
  </table>
</div>
<!-- Accent bar -->
<div style="height:4px;background:${ts.accentColor};opacity:0.6;"></div>

<!-- Body -->
<div style="padding:28px 40px;">
  <!-- Client + Dates -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="vertical-align:top;width:60%;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="width:4px;height:16px;border-radius:2px;background:${ts.accentColor};"></div>
          <span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${ts.accentColor};">Client</span>
        </div>
        <div style="margin-left:12px;font-size:13px;font-weight:500;">${esc(proposal.client_name)}</div>
        ${proposal.client_email ? `<div style="margin-left:12px;font-size:11px;color:#888;">${esc(proposal.client_email)}</div>` : ''}
        ${proposal.client_phone ? `<div style="margin-left:12px;font-size:11px;color:#888;">${esc(proposal.client_phone)}</div>` : ''}
        ${proposal.job_site_street ? `<div style="margin-left:12px;font-size:11px;color:#888;margin-top:4px;">${esc(proposal.job_site_street)}, ${esc(proposal.job_site_city)}, ${esc(proposal.job_site_state)} ${esc(proposal.job_site_zip)}</div>` : ''}
      </td>
      <td style="vertical-align:top;text-align:right;font-size:11px;color:#888;">
        <div>Date: ${esc(proposal.proposal_date)}</div>
        <div>Valid until: ${esc(proposal.valid_until)}</div>
      </td>
    </tr>
  </table>

  ${proposal.title ? `<h2 style="font-size:18px;font-weight:700;margin-bottom:20px;color:${ts.accentColor};">${esc(proposal.title)}</h2>` : ''}
  ${section('Job Description', proposal.enhanced_job_description || proposal.job_description)}
  ${section('Scope of Work', proposal.enhanced_scope_of_work || proposal.scope_of_work)}
  ${section('Materials Included', proposal.materials_included)}
  ${section('Materials Excluded', proposal.materials_excluded)}
  ${proposal.estimated_start_date || proposal.estimated_duration ? `
    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        <div style="width:4px;height:16px;border-radius:2px;background:${ts.accentColor};"></div>
        <h3 style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${ts.accentColor};margin:0;">Timeline</h3>
      </div>
      <div style="margin-left:12px;font-size:13px;">
        ${proposal.estimated_start_date ? `<div>Start date: ${esc(proposal.estimated_start_date)}</div>` : ''}
        ${proposal.estimated_duration ? `<div>Duration: ${esc(proposal.estimated_duration)}</div>` : ''}
      </div>
    </div>` : ''}
  ${lineItemsHtml}
  ${section('Payment Terms', proposal.payment_terms)}
  ${proposal.accepted_payment_methods?.length ? `<p style="font-size:11px;color:#888;margin-top:-16px;margin-bottom:20px;margin-left:12px;">Accepted: ${esc(proposal.accepted_payment_methods.join(', '))}</p>` : ''}
  ${section('Warranty', proposal.warranty_terms)}
  ${section('Disclosures', proposal.disclosures)}
  ${section('Special Conditions', proposal.special_conditions)}

  <!-- Signature Block -->
  <div style="margin-top:48px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:45%;vertical-align:bottom;">
          <div style="border-bottom:2px solid ${ts.accentColor}44;height:48px;"></div>
          <div style="font-size:11px;font-weight:600;margin-top:6px;">Client Signature</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">Name: ___________________________</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">Date: _______________</div>
        </td>
        <td style="width:10%;"></td>
        <td style="width:45%;vertical-align:bottom;">
          <div style="border-bottom:2px solid ${ts.accentColor}44;height:48px;"></div>
          <div style="font-size:11px;font-weight:600;margin-top:6px;">Contractor Signature</div>
          <div style="font-size:11px;color:#888;margin-top:2px;">Date: _______________</div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;text-align:center;">
    <div style="font-size:11px;font-weight:500;color:${ts.accentColor};">${companyName}</div>
    <div style="font-size:11px;color:#888;margin-top:2px;">${contacts}</div>
    ${profile?.license_numbers?.length ? `<div style="font-size:11px;color:#888;margin-top:2px;">Lic# ${esc(profile.license_numbers.join(', '))}</div>` : ''}
  </div>

  ${exhibitsHtml}
</div>
</body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { proposal_id } = await req.json();
    if (!proposal_id) throw new Error("Missing proposal_id");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const [proposalRes, lineItemsRes, profileRes, exhibitsRes] = await Promise.all([
      supabaseAdmin.from("proposals").select("*").eq("id", proposal_id).eq("user_id", user.id).single(),
      supabaseAdmin.from("proposal_line_items").select("*").eq("proposal_id", proposal_id).order("sort_order"),
      supabaseAdmin.from("company_profiles").select("*").eq("user_id", user.id).single(),
      supabaseAdmin.from("proposal_exhibits").select("*").eq("proposal_id", proposal_id).order("sort_order"),
    ]);

    if (proposalRes.error || !proposalRes.data) throw new Error("Proposal not found");

    const html = buildHtml(proposalRes.data, lineItemsRes.data || [], profileRes.data, exhibitsRes.data || []);

    const fileName = `proposal-${proposalRes.data.proposal_number}.html`;
    const filePath = `${user.id}/${fileName}`;

    const htmlBlob = new Blob([html], { type: 'text/html' });
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('proposal-pdfs')
      .upload(filePath, htmlBlob, { contentType: 'text/html', upsert: true });

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { data: signedUrl } = await supabaseAdmin.storage
      .from('proposal-pdfs')
      .createSignedUrl(filePath, 3600);

    return new Response(JSON.stringify({
      html,
      url: signedUrl?.signedUrl,
      fileName: `Proposal-PRO-${String(proposalRes.data.proposal_number).padStart(4, '0')}.pdf`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
