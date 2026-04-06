import type { Database } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/formatCurrency';
import { formatPhone } from '@/lib/formatPhone';
import EditableSection, { EditableLineItemRow, EditableTotals } from './EditableSection';
import type { ProposalExhibit } from '@/hooks/useProposalExhibits';
import { getTradeStyle } from './tradeStyles';

type Proposal = Database['public']['Tables']['proposals']['Row'];
type LineItem = Database['public']['Tables']['proposal_line_items']['Row'];
type CompanyProfile = Database['public']['Tables']['company_profiles']['Row'];

interface Props {
  proposal: Proposal;
  lineItems: LineItem[];
  profile: CompanyProfile | null | undefined;
  exhibits?: ProposalExhibit[];
  onFieldEdit?: (field: string, value: string) => void;
  onLineItemEdit?: (id: string, updates: { description: string; quantity: number; unit: string; unit_price: number; subtotal: number }) => void;
  onTotalsEdit?: (updates: { tax_rate: number; deposit_mode: string; deposit_value: number }) => void;
}

export default function ProposalDocument({ proposal, lineItems, profile, exhibits, onFieldEdit, onLineItemEdit, onTotalsEdit }: Props) {
  const trade = getTradeStyle((proposal as any).trade_type || profile?.trade_type);
  const address = [profile?.street_address, profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ');

  const editable = (field: string, value: string | null, children: React.ReactNode) => {
    if (!onFieldEdit || !value) return children;
    return (
      <EditableSection field={field} value={value} onSave={onFieldEdit}>
        {children}
      </EditableSection>
    );
  };

  return (
    <div className="text-sm" style={{ fontFamily: "'Inter', sans-serif", minHeight: '800px' }}>
      {/* ─── Full-width Header ─── */}
      <div className="px-8 py-6" style={{ backgroundColor: trade.headerBg, color: trade.headerText }}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {profile?.logo_url && (
              <img src={profile.logo_url} alt="Logo" className="h-10 mb-3 brightness-0 invert" />
            )}
            <div className="text-lg font-bold tracking-tight">{profile?.company_name || 'Company Name'}</div>
            {address && <div className="text-xs mt-1 opacity-80">{address}</div>}
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs mt-1 opacity-80">
              {profile?.phone && <span>{formatPhone(profile.phone)}</span>}
              {profile?.email && <span>{profile.email}</span>}
              {profile?.website && <span>{profile.website}</span>}
            </div>
            {profile?.license_numbers?.length ? (
              <div className="text-xs mt-1 opacity-70">Lic# {profile.license_numbers.join(', ')}</div>
            ) : null}
          </div>
          <div className="text-right flex-shrink-0 ml-6">
            <div className="text-2xl font-bold tracking-tight">PROPOSAL</div>
            <div className="text-xs opacity-70 mt-1">PRO-{String(proposal.proposal_number).padStart(4, '0')}</div>
          </div>
        </div>
      </div>

      {/* ─── Accent bar ─── */}
      <div className="h-1" style={{ backgroundColor: trade.accentColor, opacity: 0.6 }} />

      {/* ─── Body ─── */}
      <div className="px-8 py-6">
        {/* Client + Dates */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <SectionHeading color={trade.accentColor}>Client</SectionHeading>
            <div className="text-sm mt-2 font-medium">{proposal.client_name}</div>
            {proposal.client_email && <div className="text-xs text-muted-foreground">{proposal.client_email}</div>}
            {proposal.client_phone && <div className="text-xs text-muted-foreground">{formatPhone(proposal.client_phone)}</div>}
            {proposal.job_site_street && (
              <div className="text-xs text-muted-foreground mt-1">
                {proposal.job_site_street}, {proposal.job_site_city}, {proposal.job_site_state} {proposal.job_site_zip}
              </div>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground space-y-0.5">
            <div>Date: {proposal.proposal_date}</div>
            <div>Valid until: {proposal.valid_until}</div>
          </div>
        </div>

        {/* Title */}
        {proposal.title && editable('title', proposal.title,
          <h2 className="text-xl font-bold mb-6" style={{ color: trade.accentColor }}>{proposal.title}</h2>
        )}

        {/* Job Description */}
        {(proposal.enhanced_job_description || proposal.job_description) && (
          <Section heading="Job Description" color={trade.accentColor}>
            {editable('job_description', proposal.enhanced_job_description || proposal.job_description,
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{proposal.enhanced_job_description || proposal.job_description}</p>
            )}
          </Section>
        )}

        {/* Scope of Work */}
        {(proposal.enhanced_scope_of_work || proposal.scope_of_work) && (
          <Section heading="Scope of Work" color={trade.accentColor}>
            {editable('scope_of_work', proposal.enhanced_scope_of_work || proposal.scope_of_work,
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{proposal.enhanced_scope_of_work || proposal.scope_of_work}</p>
            )}
          </Section>
        )}

        {/* Materials */}
        {proposal.materials_included && (
          <Section heading="Materials Included" color={trade.accentColor}>
            {editable('materials_included', proposal.materials_included,
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{proposal.materials_included}</p>
            )}
          </Section>
        )}
        {proposal.materials_excluded && (
          <Section heading="Materials Excluded" color={trade.accentColor}>
            {editable('materials_excluded', proposal.materials_excluded,
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{proposal.materials_excluded}</p>
            )}
          </Section>
        )}

        {/* Timeline */}
        {(proposal.estimated_start_date || proposal.estimated_duration) && (
          <Section heading="Timeline" color={trade.accentColor}>
            <div className="text-sm space-y-0.5">
              {proposal.estimated_start_date && <div>Start date: {proposal.estimated_start_date}</div>}
              {proposal.estimated_duration && editable('estimated_duration', proposal.estimated_duration,
                <div>Duration: {proposal.estimated_duration}</div>
              )}
            </div>
          </Section>
        )}

        {/* ─── Line Items Table ─── */}
        {lineItems.length > 0 && (
          <Section heading="Pricing" color={trade.accentColor}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: trade.accentColor + '0D' }}>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: trade.accentColor }}>Description</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider w-16" style={{ color: trade.accentColor }}>Qty</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider w-16" style={{ color: trade.accentColor }}>Unit</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider w-24" style={{ color: trade.accentColor }}>Unit Price</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold uppercase tracking-wider w-24" style={{ color: trade.accentColor }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  onLineItemEdit ? (
                    <EditableLineItemRow key={item.id} item={item} onSave={onLineItemEdit} />
                  ) : (
                    <tr key={item.id} className="border-b border-gray-100" style={{ backgroundColor: idx % 2 === 1 ? '#f9fafb' : 'transparent' }}>
                      <td className="py-2.5 px-3">{item.description}</td>
                      <td className="text-right py-2.5 px-3">{item.quantity}</td>
                      <td className="text-right py-2.5 px-3">{item.unit}</td>
                      <td className="text-right py-2.5 px-3">${formatCurrency(item.unit_price)}</td>
                      <td className="text-right py-2.5 px-3 font-medium">${formatCurrency(item.subtotal)}</td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>

            {/* Totals */}
            {onTotalsEdit ? (
              <EditableTotals
                subtotal={Number(proposal.subtotal) || 0}
                taxRate={Number(proposal.tax_rate) || 0}
                depositMode={proposal.deposit_mode || 'percentage'}
                depositValue={Number(proposal.deposit_value) || 0}
                onSave={onTotalsEdit}
              />
            ) : (
              <div className="border-t-2 pt-3 mt-0 space-y-1.5 text-sm" style={{ borderColor: trade.accentColor + '33' }}>
                <div className="flex justify-between px-3"><span className="text-muted-foreground">Subtotal</span><span>${formatCurrency(proposal.subtotal)}</span></div>
                {Number(proposal.tax_rate) > 0 && (
                  <div className="flex justify-between px-3"><span className="text-muted-foreground">Tax ({proposal.tax_rate}%)</span><span>${formatCurrency(proposal.tax_amount)}</span></div>
                )}
                <div className="flex justify-between font-bold text-base px-3 py-2 rounded" style={{ backgroundColor: trade.accentColor + '0D', color: trade.accentColor }}>
                  <span>Grand Total</span><span>${formatCurrency(proposal.total)}</span>
                </div>
                {Number(proposal.deposit_amount) > 0 && (
                  <>
                    <div className="flex justify-between px-3 text-muted-foreground"><span>Deposit Due Upon Signing</span><span>${formatCurrency(proposal.deposit_amount)}</span></div>
                    <div className="flex justify-between px-3 font-semibold"><span>Balance Due Upon Completion</span><span>${formatCurrency(proposal.balance_due)}</span></div>
                  </>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Payment Terms */}
        {proposal.payment_terms && (
          <Section heading="Payment Terms" color={trade.accentColor}>
            {editable('payment_terms', proposal.payment_terms,
              <p className="text-sm leading-relaxed">{proposal.payment_terms}</p>
            )}
            {proposal.accepted_payment_methods?.length ? (
              <p className="text-xs text-muted-foreground mt-2">Accepted: {proposal.accepted_payment_methods.join(', ')}</p>
            ) : null}
          </Section>
        )}

        {/* Warranty */}
        {proposal.warranty_terms && (
          <Section heading="Warranty" color={trade.accentColor}>
            {editable('warranty_terms', proposal.warranty_terms,
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{proposal.warranty_terms}</p>
            )}
          </Section>
        )}

        {/* Disclosures */}
        {proposal.disclosures && (
          <Section heading="Disclosures" color={trade.accentColor}>
            {editable('disclosures', proposal.disclosures,
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{proposal.disclosures}</p>
            )}
          </Section>
        )}

        {/* Special Conditions */}
        {proposal.special_conditions && (
          <Section heading="Special Conditions" color={trade.accentColor}>
            {editable('special_conditions', proposal.special_conditions,
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{proposal.special_conditions}</p>
            )}
          </Section>
        )}

        {/* ─── Signature Block ─── */}
        <div className="mt-14 grid grid-cols-2 gap-12">
          <div>
            {proposal.client_signature_url ? (
              <div className="mb-1 pb-2"><img src={proposal.client_signature_url} alt="Client signature" className="h-16 object-contain" /></div>
            ) : (
              <div className="border-b-2 mb-1 pb-10" style={{ borderColor: trade.accentColor + '44' }} />
            )}
            <div className="text-xs font-semibold mt-1">Client Signature</div>
            <div className="text-xs text-muted-foreground mt-0.5">Name: ___________________________</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {proposal.client_signed_at ? `Date: ${new Date(proposal.client_signed_at).toLocaleDateString()}` : 'Date: _______________'}
            </div>
          </div>
          <div>
            {(proposal as any).contractor_signature_url ? (
              <div className="mb-1 pb-2"><img src={(proposal as any).contractor_signature_url} alt="Contractor signature" className="h-16 object-contain" /></div>
            ) : (
              <div className="border-b-2 mb-1 pb-10" style={{ borderColor: trade.accentColor + '44' }} />
            )}
            <div className="text-xs font-semibold mt-1">Contractor Signature</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {(proposal as any).contractor_signed_at ? `Date: ${new Date((proposal as any).contractor_signed_at).toLocaleDateString()}` : 'Date: _______________'}
            </div>
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="mt-10 pt-4 border-t text-center">
          <div className="text-xs font-medium" style={{ color: trade.accentColor }}>{profile?.company_name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {[profile?.phone && formatPhone(profile.phone), profile?.email, profile?.website].filter(Boolean).join(' · ')}
          </div>
          {profile?.license_numbers?.length ? (
            <div className="text-xs text-muted-foreground mt-0.5">Lic# {profile.license_numbers.join(', ')}</div>
          ) : null}
        </div>

        {/* ─── Exhibits ─── */}
        {exhibits && exhibits.length > 0 && (
          <div className="mt-10 pt-8 border-t-2 border-dashed">
            <SectionHeading color={trade.accentColor}>Exhibits & Attachments</SectionHeading>
            <div className="grid grid-cols-2 gap-4 mt-4">
              {exhibits.map((exhibit, i) => (
                <div key={exhibit.id} className="space-y-1">
                  <img src={exhibit.file_url} alt={exhibit.caption || `Exhibit ${i + 1}`} className="w-full rounded border object-contain max-h-64" />
                  <p className="text-xs text-muted-foreground text-center italic">{exhibit.caption || `Exhibit ${i + 1}`}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <div className="w-1 h-4 rounded-full" style={{ backgroundColor: color }} />
      <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color }}>{children}</h3>
    </div>
  );
}

function Section({ heading, color, children }: { heading: string; color: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <SectionHeading color={color}>{heading}</SectionHeading>
      <div className="mt-2 ml-3">{children}</div>
    </div>
  );
}
