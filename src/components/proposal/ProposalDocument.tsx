import type { Database } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/formatCurrency';
import { formatPhone } from '@/lib/formatPhone';
import { renderMarkdown } from '@/lib/renderMarkdown';
import EditableSection, { EditableLineItemRow, EditableTotals } from './EditableSection';
import type { ProposalExhibit } from '@/hooks/useProposalExhibits';
import { getTradeStyle } from './tradeStyles';
import { Phone, Mail, MapPin } from 'lucide-react';
import type { TemplateId } from './TemplateSwitcher';
import type { FontStyle, HeaderStyle } from './ProposalCustomizer';

type Proposal = Database['public']['Tables']['proposals']['Row'];
type LineItem = Database['public']['Tables']['proposal_line_items']['Row'];
type CompanyProfile = Database['public']['Tables']['company_profiles']['Row'];

const FONT_FAMILIES: Record<FontStyle, string> = {
  modern: "'Inter', 'Helvetica Neue', sans-serif",
  classic: "'Georgia', 'Times New Roman', serif",
  bold: "'Impact', 'Arial Black', sans-serif",
};

interface Props {
  proposal: Proposal;
  lineItems: LineItem[];
  profile: CompanyProfile | null | undefined;
  exhibits?: ProposalExhibit[];
  template?: TemplateId;
  customAccentColor?: string;
  fontStyle?: FontStyle;
  customHeaderStyle?: HeaderStyle;
  onFieldEdit?: (field: string, value: string) => void;
  onLineItemEdit?: (id: string, updates: { description: string; quantity: number; unit: string; unit_price: number; subtotal: number }) => void;
  onTotalsEdit?: (updates: { tax_rate: number; deposit_mode: string; deposit_value: number }) => void;
}

export default function ProposalDocument({ proposal, lineItems, profile, exhibits, template = 'modern', customAccentColor, fontStyle = 'modern', customHeaderStyle = 'dark', onFieldEdit, onLineItemEdit, onTotalsEdit }: Props) {
  const rawTrade = getTradeStyle((proposal as any).trade_type || profile?.trade_type);
  const trade = customAccentColor ? { ...rawTrade, accentColor: customAccentColor } : rawTrade;
  const fontFamily = FONT_FAMILIES[fontStyle];
  const address = [profile?.street_address, profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ');

  const editable = (field: string, value: string | null, children: React.ReactNode) => {
    if (!onFieldEdit || !value) return children;
    return (
      <EditableSection field={field} value={value} onSave={onFieldEdit}>
        {children}
      </EditableSection>
    );
  };

  // Shared data
  const proposalNumber = `PRO-${String(proposal.proposal_number).padStart(4, '0')}`;
  const jobSiteAddress = [proposal.job_site_street, proposal.job_site_city, proposal.job_site_state, proposal.job_site_zip].filter(Boolean).join(', ');

  // ─── Content sections (shared across templates) ───
  const contentSections = (SectionComp: React.FC<{ title: string; children: React.ReactNode }>) => (
    <>
      {(proposal.enhanced_job_description || proposal.job_description) && (
        <SectionComp title="Job Description">
          {editable('job_description', proposal.enhanced_job_description || proposal.job_description,
            <div className="text-sm leading-relaxed" style={{ color: '#333' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.enhanced_job_description || proposal.job_description) }} />
          )}
        </SectionComp>
      )}
      {(proposal.enhanced_scope_of_work || proposal.scope_of_work) && (
        <SectionComp title="Scope of Work">
          {editable('scope_of_work', proposal.enhanced_scope_of_work || proposal.scope_of_work,
            <div className="text-sm leading-relaxed" style={{ color: '#333' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.enhanced_scope_of_work || proposal.scope_of_work) }} />
          )}
        </SectionComp>
      )}
      {proposal.materials_included && (
        <SectionComp title="Materials Included">
          {editable('materials_included', proposal.materials_included,
            <div className="text-sm leading-relaxed" style={{ color: '#333' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.materials_included) }} />
          )}
        </SectionComp>
      )}
      {proposal.materials_excluded && (
        <SectionComp title="Materials Excluded">
          {editable('materials_excluded', proposal.materials_excluded,
            <div className="text-sm leading-relaxed" style={{ color: '#333' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.materials_excluded) }} />
          )}
        </SectionComp>
      )}
      {(proposal.estimated_start_date || proposal.estimated_duration) && (
        <SectionComp title="Timeline">
          <div className="text-sm space-y-0.5" style={{ color: '#333' }}>
            {proposal.estimated_start_date && <div>Start date: {proposal.estimated_start_date}</div>}
            {proposal.estimated_duration && editable('estimated_duration', proposal.estimated_duration,
              <div>Duration: {proposal.estimated_duration}</div>
            )}
          </div>
        </SectionComp>
      )}
    </>
  );

  const termsAndConditions = (SectionComp: React.FC<{ title: string; children: React.ReactNode }>) => (
    <>
      {proposal.payment_terms && (
        <SectionComp title="Payment Terms">
          {editable('payment_terms', proposal.payment_terms,
            <div className="text-sm leading-relaxed" style={{ color: '#333' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.payment_terms) }} />
          )}
          {proposal.accepted_payment_methods?.length ? (
            <p className="text-xs mt-2" style={{ color: '#888' }}>Accepted: {proposal.accepted_payment_methods.join(', ')}</p>
          ) : null}
        </SectionComp>
      )}
      {proposal.warranty_terms && (
        <SectionComp title="Warranty">
          {editable('warranty_terms', proposal.warranty_terms,
            <div className="text-sm leading-relaxed" style={{ color: '#333' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.warranty_terms) }} />
          )}
        </SectionComp>
      )}
      {proposal.disclosures && (
        <SectionComp title="Disclosures">
          {editable('disclosures', proposal.disclosures,
            <div className="text-sm leading-relaxed" style={{ color: '#333' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.disclosures) }} />
          )}
        </SectionComp>
      )}
      {proposal.special_conditions && (
        <SectionComp title="Special Conditions">
          {editable('special_conditions', proposal.special_conditions,
            <div className="text-sm leading-relaxed" style={{ color: '#333' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.special_conditions) }} />
          )}
        </SectionComp>
      )}
    </>
  );

  // ─── Line items table (shared) ───
  const lineItemsTable = () => {
    if (lineItems.length === 0) return null;

    return (
      <div className="mb-8" style={{ pageBreakInside: 'avoid' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, borderRadius: '6px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <thead>
            <tr style={{ backgroundColor: trade.accentColor }}>
              <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#fff', width: '40px' }}>#</th>
              <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#fff' }}>Description</th>
              <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#fff', width: '60px' }}>Qty</th>
              <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: '#fff', width: '70px' }}>Unit</th>
              <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: '#fff', width: '90px' }}>Price</th>
              <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: '#fff', width: '100px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => (
              onLineItemEdit ? (
                <EditableLineItemRow key={item.id} item={item} onSave={onLineItemEdit} />
              ) : (
                <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                  <td className="py-3.5 px-4 text-center" style={{ color: '#6b7280' }}>{idx + 1}</td>
                  <td className="py-3.5 px-4" style={{ color: '#1f2937' }}>{item.description}</td>
                  <td className="py-3.5 px-4 text-center" style={{ color: '#374151' }}>{item.quantity}</td>
                  <td className="py-3.5 px-4 text-right" style={{ color: '#6b7280' }}>{item.unit}</td>
                  <td className="py-3.5 px-4 text-right" style={{ color: '#374151' }}>${formatCurrency(item.unit_price)}</td>
                  <td className="py-3.5 px-4 text-right font-semibold" style={{ color: '#111827' }}>${formatCurrency(item.subtotal)}</td>
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
          <div className="mt-3">
            <div className="flex justify-end">
              <div className="w-72" style={{ borderTop: '2px solid #e5e7eb' }}>
                <div className="flex justify-between text-sm py-2 px-4">
                  <span className="font-semibold" style={{ color: '#374151' }}>Subtotal</span>
                  <span className="font-semibold" style={{ color: '#111827' }}>${formatCurrency(proposal.subtotal)}</span>
                </div>
                {Number(proposal.tax_rate) > 0 && (
                  <div className="flex justify-between text-sm py-2 px-4" style={{ borderTop: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#6b7280' }}>Tax ({proposal.tax_rate}%)</span>
                    <span style={{ color: '#374151' }}>${formatCurrency(proposal.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center font-bold text-base px-4 py-3 mt-1" style={{ backgroundColor: trade.accentColor, color: '#fff', borderRadius: '4px' }}>
                  <span>GRAND TOTAL</span>
                  <span>${formatCurrency(proposal.total)}</span>
                </div>
                {Number(proposal.deposit_amount) > 0 && (
                  <>
                    <div className="flex justify-between text-sm py-2 px-4 mt-2">
                      <span style={{ color: '#6b7280' }}>Deposit Due Upon Signing</span>
                      <span className="font-semibold" style={{ color: '#374151' }}>${formatCurrency(proposal.deposit_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm py-1 px-4">
                      <span style={{ color: '#6b7280' }}>Balance Due Upon Completion</span>
                      <span className="font-semibold" style={{ color: '#374151' }}>${formatCurrency(proposal.balance_due)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Signature block (shared) ───
  const signatureBlock = () => (
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
  );

  // ─── Footer (shared) ───
  const footer = () => (
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
  );

  // ─── Exhibits (shared) ───
  const exhibitsSection = () => {
    if (!exhibits || exhibits.length === 0) return null;
    return (
      <div className="px-10 mt-8 pt-8 border-t-2 border-dashed">
        <div className="mb-6">
          <h3 className="text-sm font-bold mb-2" style={{ color: '#1a1a1a' }}>Exhibits & Attachments</h3>
          <div className="grid grid-cols-2 gap-4">
            {exhibits.map((exhibit, i) => (
              <div key={exhibit.id} className="space-y-1">
                <img src={exhibit.file_url} alt={exhibit.caption || `Exhibit ${i + 1}`} className="w-full rounded border object-contain max-h-64" />
                <p className="text-xs text-center italic" style={{ color: '#888' }}>{exhibit.caption || `Exhibit ${i + 1}`}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════
  // TEMPLATE: MODERN (default — current design)
  // ════════════════════════════════════════
  if (template === 'modern') {
    return (
      <div className="bg-white text-sm" style={{ fontFamily, minHeight: '800px', color: '#1a1a1a' }}>
        {/* Logo + Company */}
        <div className="px-10 pt-10 pb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-14 w-auto object-contain" />}
              <div>
                <div className="text-xl font-extrabold tracking-tight" style={{ color: trade.accentColor }}>{profile?.company_name || 'Company Name'}</div>
                {profile?.trade_type && <div className="text-xs uppercase tracking-widest mt-0.5" style={{ color: trade.accentColor, opacity: 0.7 }}>{trade.label}</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="px-10 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-10 rounded" style={{ backgroundColor: trade.accentColor }} />
            <div className="text-3xl font-black tracking-tight" style={{ color: '#1a1a1a' }}>PROPOSAL</div>
          </div>
          <ClientInfoRow proposal={proposal} proposalNumber={proposalNumber} jobSiteAddress={jobSiteAddress} />
        </div>

        {proposal.title && (
          <div className="px-10 mb-6">
            {editable('title', proposal.title, <h2 className="text-lg font-bold" style={{ color: '#1a1a1a' }}>{proposal.title}</h2>)}
          </div>
        )}

        <div className="px-10">
          {contentSections(ModernSection)}
          {lineItemsTable()}
          {termsAndConditions(ModernSection)}
          {signatureBlock()}
        </div>
        {footer()}
        {exhibitsSection()}
      </div>
    );
  }

  // ════════════════════════════════════════
  // TEMPLATE: CLASSIC
  // ════════════════════════════════════════
  if (template === 'classic') {
    return (
      <div className="bg-white text-sm" style={{ fontFamily, minHeight: '800px', color: '#1a1a1a' }}>
        {/* Top accent line */}
        <div className="h-1" style={{ backgroundColor: trade.accentColor }} />

        <div className="px-10 pt-8 pb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-12 w-auto object-contain" />}
              <div>
                <div className="text-lg font-bold" style={{ color: '#1a1a1a' }}>{profile?.company_name || 'Company Name'}</div>
                {address && <div className="text-xs" style={{ color: '#666' }}>{address}</div>}
                {profile?.phone && <div className="text-xs" style={{ color: '#666' }}>{formatPhone(profile.phone)} • {profile.email}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tracking-tight" style={{ color: trade.accentColor }}>PROPOSAL</div>
              <div className="text-xs mt-1" style={{ color: '#666' }}>{proposalNumber}</div>
            </div>
          </div>
        </div>

        <div className="mx-10 h-px" style={{ backgroundColor: trade.accentColor }} />

        <div className="px-10 py-6">
          <ClassicInfoGrid proposal={proposal} proposalNumber={proposalNumber} jobSiteAddress={jobSiteAddress} />
        </div>

        <div className="mx-10 h-px bg-gray-200" />

        {proposal.title && (
          <div className="px-10 mt-6 mb-4">
            {editable('title', proposal.title, <h2 className="text-base font-bold border-b pb-2" style={{ color: '#1a1a1a', borderColor: '#ddd' }}>{proposal.title}</h2>)}
          </div>
        )}

        <div className="px-10">
          {contentSections(ClassicSection)}
          {lineItemsTable()}
          {termsAndConditions(ClassicSection)}
          {signatureBlock()}
        </div>

        {/* Classic footer */}
        <div className="mt-12 mx-10">
          <div className="h-1" style={{ backgroundColor: trade.accentColor }} />
          <div className="text-center py-4 text-xs" style={{ color: '#888' }}>
            {profile?.company_name} • {profile?.phone && formatPhone(profile.phone)} • {profile?.email}
          </div>
        </div>
        {exhibitsSection()}
      </div>
    );
  }

  // ════════════════════════════════════════
  // TEMPLATE: BOLD
  // ════════════════════════════════════════
  if (template === 'bold') {
    return (
      <div className="bg-white text-sm" style={{ fontFamily, minHeight: '800px', color: '#1a1a1a' }}>
        {/* Header — adapts to customHeaderStyle */}
        {customHeaderStyle === 'dark' ? (
          <div className="px-10 py-8" style={{ backgroundColor: trade.accentColor }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-14 w-auto object-contain brightness-0 invert" />}
                <div>
                  <div className="text-xl font-extrabold tracking-tight text-white">{profile?.company_name || 'Company Name'}</div>
                  {profile?.trade_type && <div className="text-xs uppercase tracking-widest mt-0.5 text-white/70">{trade.label}</div>}
                </div>
              </div>
              <div className="text-right text-white">
                <div className="text-3xl font-black">PROPOSAL</div>
                <div className="text-sm mt-1 text-white/70">{proposalNumber}</div>
              </div>
            </div>
          </div>
        ) : customHeaderStyle === 'light' ? (
          <div className="px-10 py-8 bg-white" style={{ borderTop: `4px solid ${trade.accentColor}` }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-14 w-auto object-contain" />}
                <div>
                  <div className="text-xl font-extrabold tracking-tight" style={{ color: '#1a1a1a' }}>{profile?.company_name || 'Company Name'}</div>
                  {profile?.trade_type && <div className="text-xs uppercase tracking-widest mt-0.5" style={{ color: trade.accentColor }}>{trade.label}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black" style={{ color: trade.accentColor }}>PROPOSAL</div>
                <div className="text-sm mt-1" style={{ color: '#666' }}>{proposalNumber}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-10 py-8">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-14 w-auto object-contain" />}
                <div>
                  <div className="text-xl font-extrabold tracking-tight" style={{ color: '#1a1a1a' }}>{profile?.company_name || 'Company Name'}</div>
                  {profile?.trade_type && <div className="text-xs uppercase tracking-widest mt-0.5" style={{ color: '#888' }}>{trade.label}</div>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black" style={{ color: '#1a1a1a' }}>PROPOSAL</div>
                <div className="text-sm mt-1" style={{ color: '#888' }}>{proposalNumber}</div>
              </div>
            </div>
          </div>
        )}

        <div className="px-10 py-6">
          <ClientInfoRow proposal={proposal} proposalNumber={proposalNumber} jobSiteAddress={jobSiteAddress} hideProposalNumber />
        </div>

        {proposal.title && (
          <div className="px-10 mb-6">
            {editable('title', proposal.title,
              <h2 className="text-lg font-extrabold uppercase tracking-wide" style={{ color: trade.accentColor }}>{proposal.title}</h2>
            )}
          </div>
        )}

        <div className="px-10">
          {contentSections(BoldSection)}
          {lineItemsTable()}
          {termsAndConditions(BoldSection)}
          {signatureBlock()}
        </div>
        {footer()}
        {exhibitsSection()}
      </div>
    );
  }

  // ════════════════════════════════════════
  // TEMPLATE: MINIMAL
  // ════════════════════════════════════════
  return (
    <div className="bg-white text-sm" style={{ fontFamily, minHeight: '800px', color: '#1a1a1a' }}>
      <div className="px-12 pt-14 pb-8">
        <div className="flex items-start justify-between">
          <div>
            {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-10 w-auto object-contain mb-4" />}
            <div className="text-base font-semibold" style={{ color: '#1a1a1a' }}>{profile?.company_name || 'Company Name'}</div>
            {address && <div className="text-xs mt-0.5" style={{ color: '#999' }}>{address}</div>}
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest font-medium" style={{ color: '#999' }}>Proposal</div>
            <div className="text-sm font-semibold mt-0.5">{proposalNumber}</div>
            <div className="text-xs mt-2" style={{ color: '#999' }}>
              {proposal.proposal_date && <div>{proposal.proposal_date}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-12 h-px bg-gray-100" />

      <div className="px-12 py-8">
        <div className="text-xs uppercase tracking-widest font-medium mb-2" style={{ color: '#999' }}>Prepared for</div>
        <div className="text-sm font-semibold">{proposal.client_name}</div>
        {proposal.client_email && <div className="text-xs" style={{ color: '#666' }}>{proposal.client_email}</div>}
        {proposal.client_phone && <div className="text-xs" style={{ color: '#666' }}>{formatPhone(proposal.client_phone)}</div>}
        {jobSiteAddress && <div className="text-xs mt-1" style={{ color: '#666' }}>{jobSiteAddress}</div>}
      </div>

      {proposal.title && (
        <div className="px-12 mb-6">
          {editable('title', proposal.title, <h2 className="text-base font-semibold" style={{ color: '#1a1a1a' }}>{proposal.title}</h2>)}
        </div>
      )}

      <div className="px-12">
        {contentSections(MinimalSection)}
        {lineItemsTable()}
        {termsAndConditions(MinimalSection)}
        {signatureBlock()}
      </div>

      <div className="mt-12 mx-12">
        <div className="h-px bg-gray-100" />
        <div className="flex justify-center gap-8 py-5 text-xs" style={{ color: '#999' }}>
          {profile?.phone && <span>{formatPhone(profile.phone)}</span>}
          {profile?.email && <span>{profile.email}</span>}
          {profile?.website && <span>{profile.website}</span>}
        </div>
      </div>
      {exhibitsSection()}
    </div>
  );
}

// ─── Shared sub-components ───

function ClientInfoRow({ proposal, proposalNumber, jobSiteAddress, hideProposalNumber }: {
  proposal: any; proposalNumber: string; jobSiteAddress: string; hideProposalNumber?: boolean;
}) {
  return (
    <div className="flex justify-between items-start">
      <div>
        <div className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#888' }}>To</div>
        <div className="text-base font-bold">{proposal.client_name}</div>
        {proposal.client_phone && <div className="text-sm" style={{ color: '#555' }}>{formatPhone(proposal.client_phone)}</div>}
        {proposal.client_email && <div className="text-sm" style={{ color: '#555' }}>{proposal.client_email}</div>}
        {jobSiteAddress && <div className="text-sm mt-0.5" style={{ color: '#555' }}>{jobSiteAddress}</div>}
      </div>
      {!hideProposalNumber && (
        <div className="text-right text-sm" style={{ color: '#555' }}>
          <div className="flex justify-end gap-8">
            <div><span className="font-bold" style={{ color: '#1a1a1a' }}>Proposal no :</span></div>
            <div className="font-bold" style={{ color: '#1a1a1a' }}>{proposalNumber}</div>
          </div>
          <div className="flex justify-end gap-8 mt-0.5"><div>Date :</div><div>{proposal.proposal_date}</div></div>
          <div className="flex justify-end gap-8 mt-0.5"><div>Valid until :</div><div>{proposal.valid_until}</div></div>
        </div>
      )}
    </div>
  );
}

function ClassicInfoGrid({ proposal, proposalNumber, jobSiteAddress }: { proposal: any; proposalNumber: string; jobSiteAddress: string }) {
  return (
    <div className="grid grid-cols-2 gap-8">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#888' }}>Bill To</div>
        <div className="text-sm font-semibold">{proposal.client_name}</div>
        {proposal.client_email && <div className="text-xs" style={{ color: '#555' }}>{proposal.client_email}</div>}
        {proposal.client_phone && <div className="text-xs" style={{ color: '#555' }}>{formatPhone(proposal.client_phone)}</div>}
        {jobSiteAddress && <div className="text-xs mt-1" style={{ color: '#555' }}>Job site: {jobSiteAddress}</div>}
      </div>
      <div className="text-right">
        <div className="text-xs" style={{ color: '#888' }}>Date: <span className="font-semibold text-gray-800">{proposal.proposal_date}</span></div>
        <div className="text-xs mt-0.5" style={{ color: '#888' }}>Valid until: <span className="font-semibold text-gray-800">{proposal.valid_until}</span></div>
      </div>
    </div>
  );
}

// ─── Section components per template ───

function ModernSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold mb-2" style={{ color: '#1a1a1a' }}>{title}</h3>
      {children}
    </div>
  );
}

function ClassicSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold uppercase tracking-wider mb-2 pb-1 border-b" style={{ color: '#555', borderColor: '#e0e0e0' }}>{title}</h3>
      {children}
    </div>
  );
}

function BoldSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-extrabold uppercase tracking-wide mb-2" style={{ color: '#1a1a1a' }}>{title}</h3>
      {children}
    </div>
  );
}

function MinimalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-xs uppercase tracking-widest font-medium mb-3" style={{ color: '#999' }}>{title}</h3>
      {children}
    </div>
  );
}
