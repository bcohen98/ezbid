import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '0.00';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildProposalHtml(proposal: any, lineItems: any[], profile: any, exhibits: any[]): string {
  const template = proposal.template || 'classic';
  const brandColor = profile?.brand_color || '#000000';
  const companyName = escapeHtml(profile?.company_name) || 'Company Name';
  const address = [profile?.street_address, profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ');

  let headerHtml = '';
  if (template === 'classic') {
    headerHtml = `
      <div style="background:#1a1a1a;color:#fff;padding:20px;border-radius:6px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;width:60%;">
              ${profile?.logo_url ? `<img src="${escapeHtml(profile.logo_url)}" style="height:40px;margin-bottom:8px;filter:brightness(0) invert(1);" />` : ''}
              <div style="font-weight:600;font-size:16px;">${companyName}</div>
              <div style="font-size:11px;opacity:0.7;margin-top:4px;">${escapeHtml(address)}</div>
              ${profile?.phone ? `<div style="font-size:11px;opacity:0.7;">${escapeHtml(profile.phone)}</div>` : ''}
              ${profile?.email ? `<div style="font-size:11px;opacity:0.7;">${escapeHtml(profile.email)}</div>` : ''}
              ${profile?.license_numbers?.length ? `<div style="font-size:11px;opacity:0.7;margin-top:4px;">Lic# ${escapeHtml(profile.license_numbers.join(', '))}</div>` : ''}
            </td>
            <td style="vertical-align:top;text-align:right;width:40%;color:#fff;">
              <div style="font-size:24px;font-weight:700;letter-spacing:-0.5px;">PROPOSAL</div>
              <div style="font-size:11px;opacity:0.7;margin-top:4px;">PRO-${String(proposal.proposal_number).padStart(4, '0')}</div>
            </td>
          </tr>
        </table>
      </div>`;
  } else {
    headerHtml = `
      <div style="margin-bottom:24px;${template === 'modern' ? `border-top:4px solid ${brandColor};padding-top:16px;` : ''}">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:top;width:60%;">
              ${profile?.logo_url ? `<img src="${escapeHtml(profile.logo_url)}" style="height:40px;margin-bottom:8px;" />` : ''}
              <div style="font-weight:600;font-size:16px;${template === 'modern' ? `color:${brandColor};` : ''}">${companyName}</div>
              <div style="font-size:11px;color:#888;margin-top:4px;">${escapeHtml(address)}</div>
              ${profile?.phone ? `<div style="font-size:11px;color:#888;">${escapeHtml(profile.phone)}</div>` : ''}
            </td>
            <td style="vertical-align:top;text-align:right;width:40%;">
              <div style="font-size:22px;font-weight:700;${template === 'modern' || template === 'bold' ? `color:${brandColor};` : ''}">PROPOSAL</div>
              <div style="font-size:11px;color:#888;margin-top:4px;">PRO-${String(proposal.proposal_number).padStart(4, '0')}</div>
            </td>
          </tr>
        </table>
      </div>`;
  }

  const lineItemsHtml = lineItems.length > 0 ? `
    <div style="margin-bottom:16px;">
      <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;">Pricing</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="border-bottom:1px solid #e5e5e5;color:#888;font-size:11px;">
            <th style="text-align:left;padding:8px 4px;">Description</th>
            <th style="text-align:right;padding:8px 4px;width:60px;">Qty</th>
            <th style="text-align:right;padding:8px 4px;width:60px;">Unit</th>
            <th style="text-align:right;padding:8px 4px;width:90px;">Unit Price</th>
            <th style="text-align:right;padding:8px 4px;width:90px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map(item => `
            <tr style="border-bottom:1px solid #f0f0f0;">
              <td style="padding:8px 4px;">${escapeHtml(item.description)}</td>
              <td style="text-align:right;padding:8px 4px;">${item.quantity}</td>
              <td style="text-align:right;padding:8px 4px;">${escapeHtml(item.unit)}</td>
              <td style="text-align:right;padding:8px 4px;">$${formatCurrency(item.unit_price)}</td>
              <td style="text-align:right;padding:8px 4px;">$${formatCurrency(item.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="border-top:1px solid #e5e5e5;padding-top:8px;font-size:13px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:2px 0;color:#888;">Subtotal</td><td style="padding:2px 0;text-align:right;">$${formatCurrency(proposal.subtotal)}</td></tr>
          ${Number(proposal.tax_rate) > 0 ? `<tr><td style="padding:2px 0;color:#888;">Tax (${proposal.tax_rate}%)</td><td style="padding:2px 0;text-align:right;">$${formatCurrency(proposal.tax_amount)}</td></tr>` : ''}
          <tr style="font-weight:600;font-size:15px;border-top:1px solid #e5e5e5;"><td style="padding:6px 0 2px;">Total</td><td style="padding:6px 0 2px;text-align:right;">$${formatCurrency(proposal.total)}</td></tr>
          ${Number(proposal.deposit_amount) > 0 ? `
            <tr><td style="padding:2px 0;color:#888;">Deposit required</td><td style="padding:2px 0;text-align:right;">$${formatCurrency(proposal.deposit_amount)}</td></tr>
            <tr style="font-weight:500;"><td style="padding:2px 0;">Balance due</td><td style="padding:2px 0;text-align:right;">$${formatCurrency(proposal.balance_due)}</td></tr>
          ` : ''}
        </table>
      </div>
    </div>` : '';

  const section = (title: string, content: string | null | undefined) => {
    if (!content) return '';
    return `<div style="margin-bottom:16px;"><h3 style="font-size:13px;font-weight:600;margin-bottom:4px;">${escapeHtml(title)}</h3><p style="font-size:13px;white-space:pre-wrap;margin:0;line-height:1.6;">${escapeHtml(content)}</p></div>`;
  };

  // Exhibits page
  let exhibitsHtml = '';
  if (exhibits.length > 0) {
    exhibitsHtml = `
    <div style="page-break-before:always;padding-top:40px;">
      <h2 style="font-size:18px;font-weight:600;margin-bottom:20px;">Exhibits & Attachments</h2>
      <div style="display:flex;flex-wrap:wrap;gap:16px;">
        ${exhibits.map((ex, i) => `
          <div style="margin-bottom:16px;width:100%;">
            <img src="${escapeHtml(ex.file_url)}" style="max-width:100%;max-height:500px;border:1px solid #e5e5e5;border-radius:4px;" />
            ${ex.caption ? `<p style="font-size:12px;color:#888;margin-top:4px;">${escapeHtml(ex.caption)}</p>` : `<p style="font-size:12px;color:#888;margin-top:4px;">Exhibit ${i + 1}</p>`}
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',Arial,Helvetica,sans-serif; font-size:13px; color:#1a1a1a; padding:40px; background:#fff; }
  @page { size:letter; margin:0.5in; }
</style></head><body>
${headerHtml}
<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
  <tr>
    <td style="vertical-align:top;width:60%;">
      <h3 style="font-size:13px;font-weight:600;margin-bottom:4px;">Client</h3>
      <div style="font-size:13px;">${escapeHtml(proposal.client_name)}</div>
      ${proposal.client_email ? `<div style="font-size:11px;color:#888;">${escapeHtml(proposal.client_email)}</div>` : ''}
      ${proposal.client_phone ? `<div style="font-size:11px;color:#888;">${escapeHtml(proposal.client_phone)}</div>` : ''}
      ${proposal.job_site_street ? `<div style="font-size:11px;color:#888;margin-top:4px;">${escapeHtml(proposal.job_site_street)}, ${escapeHtml(proposal.job_site_city)}, ${escapeHtml(proposal.job_site_state)} ${escapeHtml(proposal.job_site_zip)}</div>` : ''}
    </td>
    <td style="vertical-align:top;text-align:right;width:40%;font-size:11px;color:#888;">
      <div>Date: ${escapeHtml(proposal.proposal_date)}</div>
      <div>Valid until: ${escapeHtml(proposal.valid_until)}</div>
    </td>
  </tr>
</table>
${proposal.title ? `<h2 style="font-size:18px;font-weight:600;margin-bottom:16px;">${escapeHtml(proposal.title)}</h2>` : ''}
${section('Job Description', proposal.enhanced_job_description || proposal.job_description)}
${section('Scope of Work', proposal.enhanced_scope_of_work || proposal.scope_of_work)}
${section('Materials Included', proposal.materials_included)}
${section('Materials Excluded', proposal.materials_excluded)}
${proposal.estimated_start_date || proposal.estimated_duration ? `
  <div style="margin-bottom:16px;">
    <h3 style="font-size:13px;font-weight:600;margin-bottom:4px;">Timeline</h3>
    ${proposal.estimated_start_date ? `<div style="font-size:13px;">Start date: ${escapeHtml(proposal.estimated_start_date)}</div>` : ''}
    ${proposal.estimated_duration ? `<div style="font-size:13px;">Duration: ${escapeHtml(proposal.estimated_duration)}</div>` : ''}
  </div>` : ''}
${lineItemsHtml}
${section('Payment Terms', proposal.payment_terms)}
${proposal.accepted_payment_methods?.length ? `<p style="font-size:11px;color:#888;margin-top:-12px;margin-bottom:16px;">Accepted: ${escapeHtml(proposal.accepted_payment_methods.join(', '))}</p>` : ''}
${section('Warranty', proposal.warranty_terms)}
${section('Disclosures', proposal.disclosures)}
${section('Special Conditions', proposal.special_conditions)}
<div style="margin-top:48px;">
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:45%;vertical-align:bottom;"><div style="border-bottom:1px solid #ccc;height:40px;"></div><div style="font-size:11px;color:#888;margin-top:4px;">Client Signature</div><div style="font-size:11px;color:#888;margin-top:4px;">Date: _______________</div></td>
      <td style="width:10%;"></td>
      <td style="width:45%;vertical-align:bottom;"><div style="border-bottom:1px solid #ccc;height:40px;"></div><div style="font-size:11px;color:#888;margin-top:4px;">Contractor Signature</div><div style="font-size:11px;color:#888;margin-top:4px;">Date: _______________</div></td>
    </tr>
  </table>
</div>
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;text-align:center;font-size:11px;color:#888;">
  ${companyName} ${profile?.license_numbers?.length ? `· Lic# ${escapeHtml(profile.license_numbers.join(', '))}` : ''}
</div>
${exhibitsHtml}
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
    
    // Fetch all data in parallel
    const [proposalRes, lineItemsRes, profileRes, exhibitsRes] = await Promise.all([
      supabaseAdmin.from("proposals").select("*").eq("id", proposal_id).eq("user_id", user.id).single(),
      supabaseAdmin.from("proposal_line_items").select("*").eq("proposal_id", proposal_id).order("sort_order"),
      supabaseAdmin.from("company_profiles").select("*").eq("user_id", user.id).single(),
      supabaseAdmin.from("proposal_exhibits").select("*").eq("proposal_id", proposal_id).order("sort_order"),
    ]);

    if (proposalRes.error || !proposalRes.data) throw new Error("Proposal not found");

    const html = buildProposalHtml(proposalRes.data, lineItemsRes.data || [], profileRes.data, exhibitsRes.data || []);

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
