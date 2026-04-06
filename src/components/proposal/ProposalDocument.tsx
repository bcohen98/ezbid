import type { Database } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/formatCurrency';
import { formatPhone } from '@/lib/formatPhone';
import EditableSection, { EditableLineItemRow, EditableTotals } from './EditableSection';
import type { ProposalExhibit } from '@/hooks/useProposalExhibits';
import { getTradeStyle } from './tradeStyles';
import { Phone, Mail, MapPin } from 'lucide-react';

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
    <div className="bg-white text-sm" style={{ fontFamily: "'Inter', sans-serif", minHeight: '800px', color: '#1a1a1a' }}>
      {/* ─── Logo + Company Info (white background) ─── */}
      <div className="px-10 pt-10 pb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {profile?.logo_url && (
              <img src={profile.logo_url} alt="Logo" className="h-14 w-auto object-contain" />
            )}
            <div>
              <div className="text-xl font-extrabold tracking-tight" style={{ color: trade.accentColor }}>
                {profile?.company_name || 'Company Name'}
              </div>
              {profile?.trade_type && (
                <div className="text-xs uppercase tracking-widest mt-0.5" style={{ color: trade.accentColor, opacity: 0.7 }}>
                  {trade.label}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── PROPOSAL title with accent bar ─── */}
      <div className="px-10 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-10 rounded" style={{ backgroundColor: trade.accentColor }} />
          <div>
            <div className="text-3xl font-black tracking-tight" style={{ color: '#1a1a1a' }}>PROPOSAL</div>
          </div>
        </div>

        {/* Client / Proposal info row */}
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#888' }}>To</div>
            <div className="text-base font-bold">{proposal.client_name}</div>
            {proposal.client_phone && <div className="text-sm" style={{ color: '#555' }}>{formatPhone(proposal.client_phone)}</div>}
            {proposal.client_email && <div className="text-sm" style={{ color: '#555' }}>{proposal.client_email}</div>}
            {proposal.job_site_street && (
              <div className="text-sm mt-0.5" style={{ color: '#555' }}>
                {proposal.job_site_street}{proposal.job_site_city ? `, ${proposal.job_site_city}` : ''}{proposal.job_site_state ? `, ${proposal.job_site_state}` : ''} {proposal.job_site_zip || ''}
              </div>
            )}
          </div>
          <div className="text-right text-sm" style={{ color: '#555' }}>
            <div className="flex justify-end gap-8">
              <div>
                <span className="font-bold" style={{ color: '#1a1a1a' }}>Proposal no :</span>
              </div>
              <div className="font-bold" style={{ color: '#1a1a1a' }}>
                PRO-{String(proposal.proposal_number).padStart(4, '0')}
              </div>
            </div>
            <div className="flex justify-end gap-8 mt-0.5">
              <div>Date :</div>
              <div>{proposal.proposal_date}</div>
            </div>
            <div className="flex justify-end gap-8 mt-0.5">
              <div>Valid until :</div>
              <div>{proposal.valid_until}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Title ─── */}
      {proposal.title && (
        <div className="px-10 mb-6">
          {editable('title', proposal.title,
            <h2 className="text-lg font-bold" style={{ color: '#1a1a1a' }}>{proposal.title}</h2>
          )}
        </div>
      )}

      {/* ─── Content sections ─── */}
      <div className="px-10">
        {/* Job Description */}
        {(proposal.enhanced_job_description || proposal.job_description) && (
          <ContentSection title="Job Description">
            {editable('job_description', proposal.enhanced_job_description || proposal.job_description,
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#333' }}>{proposal.enhanced_job_description || proposal.job_description}</p>
            )}
          </ContentSection>
        )}

        {/* Scope of Work */}
        {(proposal.enhanced_scope_of_work || proposal.scope_of_work) && (
          <ContentSection title="Scope of Work">
            {editable('scope_of_work', proposal.enhanced_scope_of_work || proposal.scope_of_work,
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#333' }}>{proposal.enhanced_scope_of_work || proposal.scope_of_work}</p>
            )}
          </ContentSection>
        )}

        {/* Materials */}
        {proposal.materials_included && (
          <ContentSection title="Materials Included">
            {editable('materials_included', proposal.materials_included,
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#333' }}>{proposal.materials_included}</p>
            )}
          </ContentSection>
        )}
        {proposal.materials_excluded && (
          <ContentSection title="Materials Excluded">
            {editable('materials_excluded', proposal.materials_excluded,
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#333' }}>{proposal.materials_excluded}</p>
            )}
          </ContentSection>
        )}

        {/* Timeline */}
        {(proposal.estimated_start_date || proposal.estimated_duration) && (
          <ContentSection title="Timeline">
            <div className="text-sm space-y-0.5" style={{ color: '#333' }}>
              {proposal.estimated_start_date && <div>Start date: {proposal.estimated_start_date}</div>}
              {proposal.estimated_duration && editable('estimated_duration', proposal.estimated_duration,
                <div>Duration: {proposal.estimated_duration}</div>
              )}
            </div>
          </ContentSection>
        )}

        {/* ─── Line Items Table ─── */}
        {lineItems.length > 0 && (
          <div className="mb-8">
            {/* Colored header line */}
            <div className="h-0.5 mb-0" style={{ backgroundColor: trade.accentColor }} />
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: trade.accentColor }}>
                  <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-white w-8">#</th>
                  <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider text-white">Description</th>
                  <th className="text-center py-3 px-4 text-xs font-bold uppercase tracking-wider text-white w-16">Qty</th>
                  <th className="text-right py-3 px-4 text-xs font-bold uppercase tracking-wider text-white w-20">Unit</th>
                  <th className="text-right py-3 px-4 text-xs font-bold uppercase tracking-wider text-white w-24">Price</th>
                  <th className="text-right py-3 px-4 text-xs font-bold uppercase tracking-wider text-white w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  onLineItemEdit ? (
                    <EditableLineItemRow key={item.id} item={item} onSave={onLineItemEdit} />
                  ) : (
                    <tr key={item.id} className="border-b" style={{ borderColor: '#e8e8e8', borderStyle: 'dotted' }}>
                      <td className="py-3 px-4 text-center" style={{ color: '#888' }}>{idx + 1}</td>
                      <td className="py-3 px-4">{item.description}</td>
                      <td className="text-center py-3 px-4">{item.quantity}</td>
                      <td className="text-right py-3 px-4" style={{ color: '#555' }}>{item.unit}</td>
                      <td className="text-right py-3 px-4">${formatCurrency(item.unit_price)}</td>
                      <td className="text-right py-3 px-4 font-semibold">${formatCurrency(item.subtotal)}</td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
            <div className="h-0.5" style={{ backgroundColor: trade.accentColor }} />

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
              <div className="mt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">Sub Total</span>
                      <span className="font-bold">${formatCurrency(proposal.subtotal)}</span>
                    </div>
                    {Number(proposal.tax_rate) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="font-bold">Tax {proposal.tax_rate}%</span>
                        <span className="font-bold">${formatCurrency(proposal.tax_amount)}</span>
                      </div>
                    )}
                    {/* Grand Total bar */}
                    <div className="flex justify-between items-center text-white font-bold text-base px-4 py-2.5 rounded-sm mt-2" style={{ backgroundColor: trade.accentColor }}>
                      <span>GRAND TOTAL</span>
                      <span>${formatCurrency(proposal.total)}</span>
                    </div>
                    {Number(proposal.deposit_amount) > 0 && (
                      <>
                        <div className="flex justify-between text-sm mt-2">
                          <span style={{ color: '#555' }}>Deposit Due Upon Signing</span>
                          <span className="font-semibold">${formatCurrency(proposal.deposit_amount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span style={{ color: '#555' }}>Balance Due Upon Completion</span>
                          <span className="font-semibold">${formatCurrency(proposal.balance_due)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment Terms */}
        {proposal.payment_terms && (
          <ContentSection title="Payment Terms">
            {editable('payment_terms', proposal.payment_terms,
              <p className="text-sm leading-relaxed" style={{ color: '#333' }}>{proposal.payment_terms}</p>
            )}
            {proposal.accepted_payment_methods?.length ? (
              <p className="text-xs mt-2" style={{ color: '#888' }}>Accepted: {proposal.accepted_payment_methods.join(', ')}</p>
            ) : null}
          </ContentSection>
        )}

        {/* Warranty */}
        {proposal.warranty_terms && (
          <ContentSection title="Warranty">
            {editable('warranty_terms', proposal.warranty_terms,
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#333' }}>{proposal.warranty_terms}</p>
            )}
          </ContentSection>
        )}

        {/* Disclosures */}
        {proposal.disclosures && (
          <ContentSection title="Disclosures">
            {editable('disclosures', proposal.disclosures,
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#333' }}>{proposal.disclosures}</p>
            )}
          </ContentSection>
        )}

        {/* Special Conditions */}
        {proposal.special_conditions && (
          <ContentSection title="Special Conditions">
            {editable('special_conditions', proposal.special_conditions,
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#333' }}>{proposal.special_conditions}</p>
            )}
          </ContentSection>
        )}

        {/* ─── Signature Block ─── */}
        <div className="mt-14 grid grid-cols-2 gap-16">
          <div>
            {proposal.client_signature_url ? (
              <div className="mb-1 pb-2"><img src={proposal.client_signature_url} alt="Client signature" className="h-16 object-contain" /></div>
            ) : (
              <div className="border-b mb-1 pb-12" style={{ borderColor: '#ccc' }} />
            )}
            <div className="text-sm font-bold mt-2">{proposal.client_name || '___________________________'}</div>
            <div className="text-xs mt-0.5" style={{ color: trade.accentColor, fontWeight: 600 }}>Client</div>
            <div className="text-xs mt-1" style={{ color: '#888' }}>
              {proposal.client_signed_at ? `Date: ${new Date(proposal.client_signed_at).toLocaleDateString()}` : 'Date: _______________'}
            </div>
          </div>
          <div>
            {(proposal as any).contractor_signature_url ? (
              <div className="mb-1 pb-2"><img src={(proposal as any).contractor_signature_url} alt="Contractor signature" className="h-16 object-contain" /></div>
            ) : (
              <div className="border-b mb-1 pb-12" style={{ borderColor: '#ccc' }} />
            )}
            <div className="text-sm font-bold mt-2">{profile?.company_name || '___________________________'}</div>
            <div className="text-xs mt-0.5" style={{ color: trade.accentColor, fontWeight: 600 }}>Contractor</div>
            <div className="text-xs mt-1" style={{ color: '#888' }}>
              {(proposal as any).contractor_signed_at ? `Date: ${new Date((proposal as any).contractor_signed_at).toLocaleDateString()}` : 'Date: _______________'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div className="mt-12 mx-10">
        <div className="h-px" style={{ backgroundColor: trade.accentColor }} />
        <div className="flex justify-center gap-10 py-5">
          {profile?.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" style={{ color: trade.accentColor }} />
              <div>
                <div className="text-xs font-bold" style={{ color: trade.accentColor }}>Phone</div>
                <div className="text-xs" style={{ color: '#555' }}>{formatPhone(profile.phone)}</div>
              </div>
            </div>
          )}
          {profile?.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" style={{ color: trade.accentColor }} />
              <div>
                <div className="text-xs font-bold" style={{ color: trade.accentColor }}>Email</div>
                <div className="text-xs" style={{ color: '#555' }}>{profile.email}</div>
              </div>
            </div>
          )}
          {address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" style={{ color: trade.accentColor }} />
              <div>
                <div className="text-xs font-bold" style={{ color: trade.accentColor }}>Address</div>
                <div className="text-xs" style={{ color: '#555' }}>{address}</div>
              </div>
            </div>
          )}
        </div>
        {profile?.license_numbers?.length ? (
          <div className="text-center text-xs pb-4" style={{ color: '#888' }}>Lic# {profile.license_numbers.join(', ')}</div>
        ) : null}
      </div>

      {/* ─── Exhibits ─── */}
      {exhibits && exhibits.length > 0 && (
        <div className="px-10 mt-8 pt-8 border-t-2 border-dashed">
          <ContentSection title="Exhibits & Attachments">
            <div className="grid grid-cols-2 gap-4">
              {exhibits.map((exhibit, i) => (
                <div key={exhibit.id} className="space-y-1">
                  <img src={exhibit.file_url} alt={exhibit.caption || `Exhibit ${i + 1}`} className="w-full rounded border object-contain max-h-64" />
                  <p className="text-xs text-center italic" style={{ color: '#888' }}>{exhibit.caption || `Exhibit ${i + 1}`}</p>
                </div>
              ))}
            </div>
          </ContentSection>
        </div>
      )}
    </div>
  );
}

function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold mb-2" style={{ color: '#1a1a1a' }}>{title}</h3>
      {children}
    </div>
  );
}
