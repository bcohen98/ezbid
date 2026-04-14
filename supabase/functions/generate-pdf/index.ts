import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Lightweight markdown→HTML: bold, italic, bullet/numbered lists */
function mdToHtml(text: string | null | undefined): string {
  if (!text) return '';
  let html = esc(text);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<em>$1</em>');
  html = html.replace(/(?<!\w)_([^_]+?)_(?!\w)/g, '<em>$1</em>');

  const lines = html.split('\n');
  const result: string[] = [];
  let inUl = false, inOl = false;
  for (const line of lines) {
    const t = line.trim();
    const ulM = t.match(/^[-*]\s+(.+)/);
    const olM = t.match(/^(\d+)\.\s+(.+)/);
    if (ulM) {
      if (inOl) { result.push('</ol>'); inOl = false; }
      if (!inUl) { result.push('<ul style="margin:4px 0;padding-left:20px;">'); inUl = true; }
      result.push(`<li style="margin:2px 0;">${ulM[1]}</li>`);
    } else if (olM) {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (!inOl) { result.push('<ol style="margin:4px 0;padding-left:20px;">'); inOl = true; }
      result.push(`<li style="margin:2px 0;">${olM[2]}</li>`);
    } else {
      if (inUl) { result.push('</ul>'); inUl = false; }
      if (inOl) { result.push('</ol>'); inOl = false; }
      result.push(t === '' ? '<br/>' : line);
    }
  }
  if (inUl) result.push('</ul>');
  if (inOl) result.push('</ol>');
  return result.join('\n');
}

function fmt(v: number | null | undefined): string {
  if (v == null) return '0.00';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TRADES: Record<string, { bg: string; label: string }> = {
  roofing:            { bg: '#2D3436', label: 'Roofing' },
  landscaping:        { bg: '#1B4332', label: 'Landscaping' },
  hvac:               { bg: '#2C5F7C', label: 'HVAC' },
  plumbing:           { bg: '#1B2A4A', label: 'Plumbing' },
  electrical:         { bg: '#92400E', label: 'Electrical' },
  painting:           { bg: '#57534E', label: 'Painting' },
  general_contractor: { bg: '#3E2723', label: 'General Contracting' },
  pressure_washing:   { bg: '#475569', label: 'Pressure Washing' },
  foundation:         { bg: '#6B7280', label: 'Foundation' },
  flooring:           { bg: '#78350F', label: 'Flooring' },
  cabinetry:          { bg: '#5D4037', label: 'Cabinetry' },
  carpentry:          { bg: '#4E342E', label: 'Carpentry' },
  masonry:            { bg: '#795548', label: 'Masonry' },
  asphalt:            { bg: '#1F2937', label: 'Asphalt' },
  concrete:           { bg: '#4B5563', label: 'Concrete' },
  other:              { bg: '#374151', label: '' },
};

function getColor(t: string | null): string {
  return (TRADES[t || ''] || TRADES.other).bg;
}
function getLabel(t: string | null): string {
  return (TRADES[t || ''] || TRADES.other).label;
}

const FONT_FAMILIES: Record<string, string> = {
  modern: "'Inter', Arial, Helvetica, sans-serif",
  classic: "'Georgia', 'Times New Roman', serif",
  bold: "'Impact', 'Arial Black', sans-serif",
};

function buildHtml(proposal: any, lineItems: any[], profile: any, exhibits: any[], opts: { template?: string; accent_color?: string; font_style?: string; header_style?: string }): string {
  const template = opts.template || 'modern';
  const accentColor = opts.accent_color || getColor(proposal.trade_type || profile?.trade_type);
  const c = accentColor;
  const tradeLabel = getLabel(proposal.trade_type || profile?.trade_type);
  const companyName = esc(profile?.company_name) || 'Company Name';
  const addr = [profile?.street_address, profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ');
  const fontFamily = FONT_FAMILIES[opts.font_style || 'modern'] || FONT_FAMILIES.modern;
  const headerStyle = opts.header_style || 'dark';

  const phoneSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
  const mailSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;
  const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

  const section = (title: string, content: string | null | undefined) => {
    if (!content) return '';
    return `<div style="margin-bottom:20px;"><h3 style="font-size:13px;font-weight:700;margin-bottom:6px;color:#1a1a1a;">${esc(title)}</h3><div style="font-size:13px;line-height:1.7;color:#333;margin:0;">${mdToHtml(content)}</div></div>`;
  };

  const lineItemRows = lineItems.map((item: any, idx: number) => `
    <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
      <td style="padding:12px 12px;text-align:center;color:#6b7280;border-bottom:1px solid #f0f0f0;">${idx + 1}</td>
      <td style="padding:12px 12px;color:#1f2937;border-bottom:1px solid #f0f0f0;">${esc(item.description)}</td>
      <td style="padding:12px 12px;text-align:center;color:#374151;border-bottom:1px solid #f0f0f0;">${item.quantity}</td>
      <td style="padding:12px 12px;text-align:right;color:#6b7280;border-bottom:1px solid #f0f0f0;">${esc(item.unit)}</td>
      <td style="padding:12px 12px;text-align:right;color:#374151;border-bottom:1px solid #f0f0f0;">$${fmt(item.unit_price)}</td>
      <td style="padding:12px 12px;text-align:right;font-weight:600;color:#111827;border-bottom:1px solid #f0f0f0;">$${fmt(item.subtotal)}</td>
    </tr>`).join('');

  const lineItemsHtml = lineItems.length > 0 ? `
    <div style="margin-bottom:28px;page-break-inside:avoid;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <thead>
          <tr style="background:${c};">
            <th style="padding:12px 12px;text-align:center;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:40px;">#</th>
            <th style="padding:12px 12px;text-align:left;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
            <th style="padding:12px 12px;text-align:center;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:60px;">Qty</th>
            <th style="padding:12px 12px;text-align:right;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:70px;">Unit</th>
            <th style="padding:12px 12px;text-align:right;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:90px;">Price</th>
            <th style="padding:12px 12px;text-align:right;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;width:100px;">Total</th>
          </tr>
        </thead>
        <tbody>${lineItemRows}</tbody>
      </table>

      <div style="margin-top:12px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="width:60%;"></td><td style="border-top:2px solid #e5e7eb;"></td><td style="border-top:2px solid #e5e7eb;"></td></tr>
          <tr><td style="width:60%;"></td><td style="text-align:right;padding:8px 12px;font-weight:600;font-size:13px;color:#374151;">Subtotal</td><td style="text-align:right;padding:8px 12px;font-weight:600;font-size:13px;color:#111827;">$${fmt(proposal.subtotal)}</td></tr>
          ${Number(proposal.tax_rate) > 0 ? `<tr><td></td><td style="text-align:right;padding:6px 12px;font-size:13px;color:#6b7280;">Tax (${proposal.tax_rate}%)</td><td style="text-align:right;padding:6px 12px;font-size:13px;color:#374151;">$${fmt(proposal.tax_amount)}</td></tr>` : ''}
          <tr><td colspan="3" style="padding:6px 0 0;">
            <table style="width:100%;border-collapse:collapse;">
              <tr style="background:${c};color:#fff;">
                <td style="padding:12px 16px;font-weight:700;font-size:14px;border-radius:4px 0 0 4px;">GRAND TOTAL</td>
                <td style="padding:12px 16px;text-align:right;font-weight:700;font-size:14px;border-radius:0 4px 4px 0;">$${fmt(proposal.total)}</td>
              </tr>
            </table>
          </td></tr>
          ${Number(proposal.deposit_amount) > 0 ? `
            <tr><td></td><td style="text-align:right;padding:8px 12px 2px;font-size:12px;color:#6b7280;">Deposit Due Upon Signing</td><td style="text-align:right;padding:8px 12px 2px;font-size:12px;font-weight:600;color:#374151;">$${fmt(proposal.deposit_amount)}</td></tr>
            <tr><td></td><td style="text-align:right;padding:2px 12px;font-size:12px;color:#6b7280;">Balance Due Upon Completion</td><td style="text-align:right;padding:2px 12px;font-size:12px;font-weight:600;color:#374151;">$${fmt(proposal.balance_due)}</td></tr>
          ` : ''}
        </table>
      </div>
    </div>` : '';

  let exhibitsHtml = '';
  if (exhibits.length > 0) {
    exhibitsHtml = `
    <div style="page-break-before:always;padding-top:40px;">
      <h3 style="font-size:13px;font-weight:700;margin-bottom:16px;">Exhibits & Attachments</h3>
      ${exhibits.map((ex: any, i: number) => `
        <div style="margin-bottom:16px;">
          <img src="${esc(ex.file_url)}" style="max-width:100%;max-height:500px;border:1px solid #e5e5e5;border-radius:4px;" />
          <p style="font-size:12px;color:#888;margin-top:4px;font-style:italic;">${ex.caption ? esc(ex.caption) : `Exhibit ${i + 1}`}</p>
        </div>
      `).join('')}
    </div>`;
  }

  const proposalNumber = `PRO-${String(proposal.proposal_number).padStart(4, '0')}`;
  const jobSiteAddr = [proposal.job_site_street, proposal.job_site_city, proposal.job_site_state, proposal.job_site_zip].filter(Boolean).join(', ');

  // Client info block
  const clientInfoHtml = `
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;width:55%;">
          <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:4px;">To</div>
          <div style="font-size:14px;font-weight:700;">${esc(proposal.client_name)}</div>
          ${proposal.client_phone ? `<div style="font-size:12px;color:#555;">${esc(proposal.client_phone)}</div>` : ''}
          ${proposal.client_email ? `<div style="font-size:12px;color:#555;">${esc(proposal.client_email)}</div>` : ''}
          ${jobSiteAddr ? `<div style="font-size:12px;color:#555;margin-top:2px;">${esc(jobSiteAddr)}</div>` : ''}
        </td>
        <td style="vertical-align:top;text-align:right;font-size:12px;color:#555;">
          <table style="border-collapse:collapse;margin-left:auto;">
            <tr><td style="font-weight:700;color:#1a1a1a;padding:2px 8px;text-align:right;">Proposal no :</td><td style="font-weight:700;color:#1a1a1a;padding:2px 0;">${proposalNumber}</td></tr>
            <tr><td style="padding:2px 8px;text-align:right;">Date :</td><td style="padding:2px 0;">${esc(proposal.proposal_date)}</td></tr>
            <tr><td style="padding:2px 8px;text-align:right;">Valid until :</td><td style="padding:2px 0;">${esc(proposal.valid_until)}</td></tr>
          </table>
        </td>
      </tr>
    </table>`;

  // Signature block
  const sigHtml = `
    <div style="margin-top:48px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:42%;vertical-align:bottom;">
            ${proposal.client_signature_url ? `<div style="margin-bottom:4px;"><img src="${esc(proposal.client_signature_url)}" style="height:48px;" /></div>` : `<div style="border-bottom:1px solid #ccc;height:48px;"></div>`}
            <div style="font-size:12px;font-weight:700;margin-top:6px;">${esc(proposal.client_name) || '___________________________'}</div>
            <div style="font-size:11px;font-weight:600;color:${c};margin-top:2px;">Client</div>
            <div style="font-size:11px;color:#888;margin-top:2px;">${proposal.client_signed_at ? `Date: ${new Date(proposal.client_signed_at).toLocaleDateString()}` : 'Date: _______________'}</div>
          </td>
          <td style="width:16%;"></td>
          <td style="width:42%;vertical-align:bottom;">
            ${proposal.contractor_signature_url ? `<div style="margin-bottom:4px;"><img src="${esc(proposal.contractor_signature_url)}" style="height:48px;" /></div>` : `<div style="border-bottom:1px solid #ccc;height:48px;"></div>`}
            <div style="font-size:12px;font-weight:700;margin-top:6px;">${companyName}</div>
            <div style="font-size:11px;font-weight:600;color:${c};margin-top:2px;">Contractor</div>
            <div style="font-size:11px;color:#888;margin-top:2px;">${proposal.contractor_signed_at ? `Date: ${new Date(proposal.contractor_signed_at).toLocaleDateString()}` : 'Date: _______________'}</div>
          </td>
        </tr>
      </table>
    </div>`;

  // Footer
  const footerHtml = `
    <div style="margin-top:40px;border-top:1px solid ${c};padding-top:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          ${profile?.phone ? `<td style="text-align:center;vertical-align:top;"><table style="border-collapse:collapse;margin:0 auto;"><tr><td style="vertical-align:middle;padding-right:6px;">${phoneSvg}</td><td style="vertical-align:top;"><div style="font-size:11px;font-weight:700;color:${c};">Phone</div><div style="font-size:11px;color:#555;">${esc(profile.phone)}</div></td></tr></table></td>` : ''}
          ${profile?.email ? `<td style="text-align:center;vertical-align:top;"><table style="border-collapse:collapse;margin:0 auto;"><tr><td style="vertical-align:middle;padding-right:6px;">${mailSvg}</td><td style="vertical-align:top;"><div style="font-size:11px;font-weight:700;color:${c};">Email</div><div style="font-size:11px;color:#555;">${esc(profile.email)}</div></td></tr></table></td>` : ''}
          ${addr ? `<td style="text-align:center;vertical-align:top;"><table style="border-collapse:collapse;margin:0 auto;"><tr><td style="vertical-align:middle;padding-right:6px;">${pinSvg}</td><td style="vertical-align:top;"><div style="font-size:11px;font-weight:700;color:${c};">Address</div><div style="font-size:11px;color:#555;">${esc(addr)}</div></td></tr></table></td>` : ''}
        </tr>
      </table>
      ${profile?.license_numbers?.length ? `<div style="text-align:center;font-size:11px;color:#888;margin-top:8px;">Lic# ${esc(profile.license_numbers.join(', '))}</div>` : ''}
    </div>`;

  // Build header based on template and header style
  let headerHtml = '';

  if (template === 'modern') {
    headerHtml = `
      <div style="padding:40px 40px 24px;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="vertical-align:middle;">
            <table style="border-collapse:collapse;"><tr>
              ${profile?.logo_url ? `<td style="vertical-align:middle;padding-right:14px;"><img src="${esc(profile.logo_url)}" style="height:48px;" /></td>` : ''}
              <td style="vertical-align:middle;">
                <div style="font-size:20px;font-weight:800;color:${c};letter-spacing:-0.5px;">${companyName}</div>
                ${tradeLabel ? `<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:${c};opacity:0.7;margin-top:2px;">${esc(tradeLabel)}</div>` : ''}
              </td>
            </tr></table>
          </td>
        </tr></table>
      </div>
      <div style="padding:0 40px 28px;">
        <table style="border-collapse:collapse;margin-bottom:24px;"><tr>
          <td style="width:48px;height:40px;background:${c};border-radius:4px;"></td>
          <td style="padding-left:12px;vertical-align:middle;"><span style="font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#1a1a1a;">PROPOSAL</span></td>
        </tr></table>
        ${clientInfoHtml}
      </div>`;
  } else if (template === 'classic') {
    headerHtml = `
      <div style="height:4px;background:${c};"></div>
      <div style="padding:32px 40px 24px;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="vertical-align:middle;">
            <table style="border-collapse:collapse;"><tr>
              ${profile?.logo_url ? `<td style="vertical-align:middle;padding-right:14px;"><img src="${esc(profile.logo_url)}" style="height:40px;" /></td>` : ''}
              <td style="vertical-align:middle;">
                <div style="font-size:18px;font-weight:700;color:#1a1a1a;">${companyName}</div>
                ${addr ? `<div style="font-size:11px;color:#666;">${esc(addr)}</div>` : ''}
                ${profile?.phone ? `<div style="font-size:11px;color:#666;">${esc(profile.phone)}${profile?.email ? ` • ${esc(profile.email)}` : ''}</div>` : ''}
              </td>
            </tr></table>
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <div style="font-size:24px;font-weight:700;color:${c};">PROPOSAL</div>
            <div style="font-size:11px;color:#666;margin-top:2px;">${proposalNumber}</div>
          </td>
        </tr></table>
      </div>
      <div style="margin:0 40px;height:1px;background:${c};"></div>
      <div style="padding:24px 40px;">${clientInfoHtml}</div>
      <div style="margin:0 40px;height:1px;background:#e0e0e0;"></div>`;
  } else if (template === 'bold') {
    if (headerStyle === 'dark') {
      headerHtml = `
        <div style="padding:32px 40px;background:${c};">
          <table style="width:100%;border-collapse:collapse;"><tr>
            <td style="vertical-align:middle;">
              <table style="border-collapse:collapse;"><tr>
                ${profile?.logo_url ? `<td style="vertical-align:middle;padding-right:14px;"><img src="${esc(profile.logo_url)}" style="height:48px;filter:brightness(0) invert(1);" /></td>` : ''}
                <td style="vertical-align:middle;">
                  <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">${companyName}</div>
                  ${tradeLabel ? `<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.7);margin-top:2px;">${esc(tradeLabel)}</div>` : ''}
                </td>
              </tr></table>
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <div style="font-size:28px;font-weight:900;color:#fff;">PROPOSAL</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;">${proposalNumber}</div>
            </td>
          </tr></table>
        </div>
        <div style="padding:24px 40px;">${clientInfoHtml}</div>`;
    } else if (headerStyle === 'light') {
      headerHtml = `
        <div style="border-top:4px solid ${c};padding:32px 40px;">
          <table style="width:100%;border-collapse:collapse;"><tr>
            <td style="vertical-align:middle;">
              <table style="border-collapse:collapse;"><tr>
                ${profile?.logo_url ? `<td style="vertical-align:middle;padding-right:14px;"><img src="${esc(profile.logo_url)}" style="height:48px;" /></td>` : ''}
                <td style="vertical-align:middle;">
                  <div style="font-size:20px;font-weight:800;color:#1a1a1a;letter-spacing:-0.5px;">${companyName}</div>
                  ${tradeLabel ? `<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:${c};margin-top:2px;">${esc(tradeLabel)}</div>` : ''}
                </td>
              </tr></table>
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <div style="font-size:28px;font-weight:900;color:${c};">PROPOSAL</div>
              <div style="font-size:12px;color:#666;margin-top:2px;">${proposalNumber}</div>
            </td>
          </tr></table>
        </div>
        <div style="padding:0 40px 24px;">${clientInfoHtml}</div>`;
    } else {
      headerHtml = `
        <div style="padding:32px 40px;">
          <table style="width:100%;border-collapse:collapse;"><tr>
            <td style="vertical-align:middle;">
              <table style="border-collapse:collapse;"><tr>
                ${profile?.logo_url ? `<td style="vertical-align:middle;padding-right:14px;"><img src="${esc(profile.logo_url)}" style="height:48px;" /></td>` : ''}
                <td style="vertical-align:middle;">
                  <div style="font-size:20px;font-weight:800;color:#1a1a1a;letter-spacing:-0.5px;">${companyName}</div>
                  ${tradeLabel ? `<div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-top:2px;">${esc(tradeLabel)}</div>` : ''}
                </td>
              </tr></table>
            </td>
            <td style="text-align:right;vertical-align:middle;">
              <div style="font-size:28px;font-weight:900;color:#1a1a1a;">PROPOSAL</div>
              <div style="font-size:12px;color:#888;margin-top:2px;">${proposalNumber}</div>
            </td>
          </tr></table>
        </div>
        <div style="padding:0 40px 24px;">${clientInfoHtml}</div>`;
    }
  } else {
    // minimal
    headerHtml = `
      <div style="padding:48px 48px 32px;">
        <table style="width:100%;border-collapse:collapse;"><tr>
          <td style="vertical-align:top;">
            ${profile?.logo_url ? `<img src="${esc(profile.logo_url)}" style="height:36px;margin-bottom:12px;" />` : ''}
            <div style="font-size:15px;font-weight:600;color:#1a1a1a;">${companyName}</div>
            ${addr ? `<div style="font-size:11px;color:#999;margin-top:2px;">${esc(addr)}</div>` : ''}
          </td>
          <td style="text-align:right;vertical-align:top;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:500;color:#999;">Proposal</div>
            <div style="font-size:13px;font-weight:600;margin-top:2px;">${proposalNumber}</div>
            ${proposal.proposal_date ? `<div style="font-size:11px;color:#999;margin-top:8px;">${esc(proposal.proposal_date)}</div>` : ''}
          </td>
        </tr></table>
      </div>
      <div style="margin:0 48px;height:1px;background:#f0f0f0;"></div>
      <div style="padding:32px 48px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:500;color:#999;margin-bottom:8px;">Prepared for</div>
        <div style="font-size:13px;font-weight:600;">${esc(proposal.client_name)}</div>
        ${proposal.client_email ? `<div style="font-size:11px;color:#666;">${esc(proposal.client_email)}</div>` : ''}
        ${proposal.client_phone ? `<div style="font-size:11px;color:#666;">${esc(proposal.client_phone)}</div>` : ''}
        ${jobSiteAddr ? `<div style="font-size:11px;color:#666;margin-top:4px;">${esc(jobSiteAddr)}</div>` : ''}
      </div>`;
  }

  const padding = template === 'minimal' ? '48px' : '40px';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:${fontFamily}; font-size:13px; color:#1a1a1a; background:#fff; }
  @page { size:letter; margin:0; }
</style></head><body>

${headerHtml}

<!-- Content -->
<div style="padding:0 ${padding};">
  ${proposal.title ? `<h2 style="font-size:17px;font-weight:700;margin-bottom:20px;color:#1a1a1a;">${esc(proposal.title)}</h2>` : ''}
  ${section('Job Description', proposal.enhanced_job_description || proposal.job_description)}
  ${section('Scope of Work', proposal.enhanced_scope_of_work || proposal.scope_of_work)}
  ${section('Materials Included', proposal.materials_included)}
  ${section('Materials Excluded', proposal.materials_excluded)}
  ${proposal.estimated_start_date || proposal.estimated_duration ? `
    <div style="margin-bottom:20px;">
      <h3 style="font-size:13px;font-weight:700;margin-bottom:6px;color:#1a1a1a;">Timeline</h3>
      <div style="font-size:13px;color:#333;">
        ${proposal.estimated_start_date ? `<div>Start date: ${esc(proposal.estimated_start_date)}</div>` : ''}
        ${proposal.estimated_duration ? `<div>Duration: ${esc(proposal.estimated_duration)}</div>` : ''}
      </div>
    </div>` : ''}
  ${lineItemsHtml}
  ${section('Payment Terms', proposal.payment_terms)}
  ${proposal.accepted_payment_methods?.length ? `<p style="font-size:11px;color:#888;margin-top:-16px;margin-bottom:20px;">Accepted: ${esc(proposal.accepted_payment_methods.join(', '))}</p>` : ''}
  ${section('Warranty', proposal.warranty_terms)}
  ${section('Disclosures', proposal.disclosures)}
  ${section('Special Conditions', proposal.special_conditions)}

  ${sigHtml}
  ${footerHtml}
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

    const body = await req.json();
    const { proposal_id, template, accent_color, font_style, header_style } = body;
    if (!proposal_id) throw new Error("Missing proposal_id");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const [proposalRes, lineItemsRes, profileRes, exhibitsRes] = await Promise.all([
      supabaseAdmin.from("proposals").select("*").eq("id", proposal_id).eq("user_id", user.id).single(),
      supabaseAdmin.from("proposal_line_items").select("*").eq("proposal_id", proposal_id).order("sort_order"),
      supabaseAdmin.from("company_profiles").select("*").eq("user_id", user.id).single(),
      supabaseAdmin.from("proposal_exhibits").select("*").eq("proposal_id", proposal_id).order("sort_order"),
    ]);

    if (proposalRes.error || !proposalRes.data) throw new Error("Proposal not found");

    const proposal = proposalRes.data;
    const opts = {
      template: template || proposal.template || 'modern',
      accent_color: accent_color || proposal.custom_accent_color || undefined,
      font_style: font_style || proposal.font_style || 'modern',
      header_style: header_style || proposal.header_style || 'dark',
    };

    const html = buildHtml(proposal, lineItemsRes.data || [], profileRes.data, exhibitsRes.data || [], opts);

    const fileName = `proposal-${proposal.proposal_number}.html`;
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
      fileName: `Proposal-PRO-${String(proposal.proposal_number).padStart(4, '0')}.pdf`
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
