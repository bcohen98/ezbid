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
import { classifyLineItem } from '@/lib/classifyLineItem';

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
  /** When true, render the client-facing view: respects show_materials, show_quantities, show_pricing on the proposal. */
  clientView?: boolean;
  /** Optional overrides for client-side interactive toggles (take precedence over DB fields). */
  showMaterialsOverride?: boolean;
  showQuantitiesOverride?: boolean;
  showPricingOverride?: boolean;
  onFieldEdit?: (field: string, value: string) => void;
  onLineItemEdit?: (id: string, updates: { description: string; quantity: number; unit: string; unit_price: number; subtotal: number }) => void;
  onDeleteLineItem?: (id: string) => void;
  onAddLineItem?: () => void;
  onTotalsEdit?: (updates: { tax_rate: number; deposit_mode: string; deposit_value: number }) => void;
}

export default function ProposalDocument({ proposal, lineItems, profile, exhibits, template = 'edge', customAccentColor, fontStyle = 'modern', customHeaderStyle = 'dark', clientView = false, showMaterialsOverride, showQuantitiesOverride, showPricingOverride, onFieldEdit, onLineItemEdit, onDeleteLineItem, onAddLineItem, onTotalsEdit }: Props) {
  const rawTrade = getTradeStyle((proposal as any).trade_type || profile?.trade_type);
  const trade = customAccentColor ? { ...rawTrade, accentColor: customAccentColor } : rawTrade;
  const fontFamily = FONT_FAMILIES[fontStyle];
  const address = [profile?.street_address, profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ');

  // Granular client-view visibility — overrides take precedence; otherwise read DB fields; defaults true so legacy proposals show everything.
  const showMaterials = showMaterialsOverride ?? (!clientView || (proposal as any).show_materials !== false);
  const showQuantities = showQuantitiesOverride ?? (!clientView || (proposal as any).show_quantities !== false);
  const showPricing = showPricingOverride ?? (!clientView || (proposal as any).show_pricing !== false);

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
      {/* Job Description is internal AI context only — never show on client-facing proposal */}
      {(proposal.enhanced_scope_of_work || proposal.scope_of_work) && (
        <SectionComp title="Scope of Work">
          {editable('scope_of_work', proposal.enhanced_scope_of_work || proposal.scope_of_work,
            <div className="text-sm leading-relaxed" style={{ color: '#333' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.enhanced_scope_of_work || proposal.scope_of_work) }} />
          )}
        </SectionComp>
      )}
      {showMaterials && proposal.materials_included && (
        <SectionComp title="Materials Included">
          {editable('materials_included', proposal.materials_included,
            <div className="text-sm leading-relaxed" style={{ color: '#333' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(proposal.materials_included) }} />
          )}
        </SectionComp>
      )}
      {showMaterials && proposal.materials_excluded && (
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

    // Editing only allowed on contractor view (not client view).
    const allowEdit = !clientView && !!onLineItemEdit;
    const allowAdd = !clientView && !!onAddLineItem;
    const allowDelete = !clientView && !!onDeleteLineItem;
    const allowTotalsEdit = !clientView && !!onTotalsEdit;

    // Split items by classification.
    const materialsList = lineItems.filter(i => classifyLineItem(i as any) === 'material');
    const laborList = lineItems.filter(i => classifyLineItem(i as any) === 'labor');
    const materialsSubtotal = materialsList.reduce((s, i) => s + Number(i.subtotal || 0), 0);
    const laborSubtotal = laborList.reduce((s, i) => s + Number(i.subtotal || 0), 0);

    // showMaterials toggle hides MATERIAL ROWS (not the description column)
    const sections = [
      { key: 'material' as const, label: 'Materials', list: showMaterials ? materialsList : [], subtotal: materialsSubtotal, visible: showMaterials },
      { key: 'labor' as const, label: 'Labor & Services', list: laborList, subtotal: laborSubtotal, visible: true },
    ].filter(s => s.visible && s.list.length > 0);

    const colCount = 2 /* # + Description */ + (showQuantities ? 2 : 0) + (showPricing ? 2 : 0) + (allowDelete ? 1 : 0);

    const renderRow = (item: LineItem, idx: number) => (
      allowEdit ? (
        <EditableLineItemRow key={item.id} item={item} index={idx + 1} onSave={onLineItemEdit!} onDelete={allowDelete ? onDeleteLineItem : undefined} />
      ) : (
        <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
          <td className="py-3.5 px-4 text-center" style={{ color: '#6b7280' }}>{idx + 1}</td>
          <td className="py-3.5 px-4" style={{ color: '#1f2937' }}>{item.description}</td>
          {showQuantities && <td className="py-3.5 px-4 text-center" style={{ color: '#374151' }}>{item.quantity}</td>}
          {showQuantities && <td className="py-3.5 px-4 text-right" style={{ color: '#6b7280' }}>{item.unit}</td>}
          {showPricing && <td className="py-3.5 px-4 text-right" style={{ color: '#374151' }}>${formatCurrency(item.unit_price)}</td>}
          {showPricing && <td className="py-3.5 px-4 text-right font-semibold" style={{ color: '#111827' }}>${formatCurrency(item.subtotal)}</td>}
        </tr>
      )
    );

    return (
      <div className="mb-8" style={{ pageBreakInside: 'avoid' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: 0, borderRadius: '6px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          <thead>
            <tr style={{ backgroundColor: trade.accentColor }}>
              <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#fff', width: '40px' }}>#</th>
              <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#fff' }}>Description</th>
              {showQuantities && (
                <th className="py-3 px-4 text-center text-xs font-bold uppercase tracking-wider" style={{ color: '#fff', width: '60px' }}>Qty</th>
              )}
              {showQuantities && (
                <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: '#fff', width: '70px' }}>Unit</th>
              )}
              {showPricing && (
                <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: '#fff', width: '90px' }}>Price</th>
              )}
              {showPricing && (
                <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider" style={{ color: '#fff', width: '100px' }}>Total</th>
              )}
              {allowDelete && <th style={{ width: '32px' }} />}
            </tr>
          </thead>
          {sections.map(section => (
            <tbody key={`section-${section.key}`}>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <td colSpan={colCount} className="py-2 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: '#374151' }}>
                  {section.label}
                </td>
              </tr>
              {section.list.map((item, idx) => renderRow(item, idx))}
              {showPricing && (
                <tr style={{ backgroundColor: '#fafafa' }}>
                  <td colSpan={colCount - 1} className="py-2 px-4 text-right text-xs font-medium" style={{ color: '#6b7280' }}>
                    {section.label} Subtotal
                  </td>
                  <td className="py-2 px-4 text-right text-xs font-semibold" style={{ color: '#111827' }}>
                    ${formatCurrency(section.subtotal)}
                  </td>
                  {allowDelete && <td />}
                </tr>
              )}
            </tbody>
          ))}
        </table>

        {/* Add line item button */}
        {allowAdd && (
          <button
            type="button"
            onClick={onAddLineItem}
            className="mt-2 flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors"
            style={{ color: trade.accentColor }}
          >
            <span className="text-lg leading-none">+</span> Add line item
          </button>
        )}

        {/* Totals — grand total ALWAYS visible to client regardless of toggles. */}
        {allowTotalsEdit ? (
          <EditableTotals
            subtotal={Number(proposal.subtotal) || 0}
            taxRate={Number(proposal.tax_rate) || 0}
            depositMode={proposal.deposit_mode || 'percentage'}
            depositValue={Number(proposal.deposit_value) || 0}
            onSave={onTotalsEdit!}
          />
        ) : (
          <div className="mt-3">
            <div className="flex justify-end">
              <div className="w-72" style={{ borderTop: '2px solid #e5e7eb' }}>
                {showPricing && (
                  <div className="flex justify-between text-sm py-2 px-4">
                    <span className="font-semibold" style={{ color: '#374151' }}>Subtotal</span>
                    <span className="font-semibold" style={{ color: '#111827' }}>${formatCurrency(proposal.subtotal)}</span>
                  </div>
                )}
                {showPricing && Number(proposal.tax_rate) > 0 && (
                  <div className="flex justify-between text-sm py-2 px-4" style={{ borderTop: '1px solid #f0f0f0' }}>
                    <span style={{ color: '#6b7280' }}>Tax ({proposal.tax_rate}%)</span>
                    <span style={{ color: '#374151' }}>${formatCurrency(proposal.tax_amount)}</span>
                  </div>
                )}
                {showPricing && (
                  <div className="flex justify-between items-center font-bold text-base px-4 py-3 mt-1" style={{ backgroundColor: trade.accentColor, color: '#fff', borderRadius: '4px' }}>
                    <span>GRAND TOTAL</span>
                    <span>${formatCurrency(proposal.total)}</span>
                  </div>
                )}
                {showPricing && Number(proposal.deposit_amount) > 0 && (
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
  // TEMPLATE: EDGE (was Modern)
  // ════════════════════════════════════════
  if (template === 'edge') {
    // Header style: dark = solid colored bar above title; light = white with accent top border; minimal = no colored bar.
    const edgeHeaderTopBar = customHeaderStyle === 'dark'
      ? <div style={{ height: '8px', backgroundColor: trade.accentColor }} />
      : customHeaderStyle === 'light'
        ? <div style={{ borderTop: `3px solid ${trade.accentColor}` }} />
        : <div style={{ borderTop: '1px solid #eee' }} />;
    const edgeHeaderTextColor = customHeaderStyle === 'dark' ? '#fff' : '#111';
    const edgeHeaderBg = customHeaderStyle === 'dark' ? trade.accentColor : 'transparent';
    const edgeAccentText = customHeaderStyle === 'dark' ? '#fff' : trade.accentColor;
    return (
      <div className="bg-white text-sm" style={{ fontFamily, minHeight: '800px', color: '#1a1a1a' }}>
        {edgeHeaderTopBar}
        <div className="px-10 pt-8 pb-6" style={{ backgroundColor: edgeHeaderBg }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className={customHeaderStyle === 'dark' ? 'h-12 w-auto object-contain brightness-0 invert' : 'h-12 w-auto object-contain'} />}
              <div>
                <div className="text-xl font-bold tracking-tight" style={{ color: edgeHeaderTextColor, letterSpacing: '-0.5px' }}>{profile?.company_name || 'Company Name'}</div>
                {profile?.trade_type && <div className="text-xs uppercase mt-0.5" style={{ letterSpacing: '2px', color: customHeaderStyle === 'dark' ? 'rgba(255,255,255,0.7)' : '#999' }}>{trade.label}</div>}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase" style={{ letterSpacing: '3px', color: customHeaderStyle === 'dark' ? 'rgba(255,255,255,0.7)' : '#999' }}>Proposal</div>
              <div className="text-lg font-semibold mt-0.5" style={{ color: edgeAccentText }}>{proposalNumber}</div>
            </div>
          </div>
          {customHeaderStyle !== 'dark' && <div className="mt-6" style={{ borderBottom: `2px solid ${trade.accentColor}` }} />}
        </div>
        <div className="px-10 py-5" style={{ borderBottom: '1px solid #eee' }}>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-xs uppercase mb-1" style={{ letterSpacing: '2px', color: '#aaa' }}>Prepared for</div>
              <div className="text-sm font-semibold" style={{ color: '#111' }}>{proposal.client_name}</div>
              {proposal.client_phone && <div className="text-xs mt-0.5" style={{ color: '#555' }}>{formatPhone(proposal.client_phone)}</div>}
              {proposal.client_email && <div className="text-xs" style={{ color: '#555' }}>{proposal.client_email}</div>}
            </div>
            <div>
              <div className="text-xs uppercase mb-1" style={{ letterSpacing: '2px', color: '#aaa' }}>Job site</div>
              <div className="text-xs" style={{ color: '#555' }}>{jobSiteAddress || '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase mb-1" style={{ letterSpacing: '2px', color: '#aaa' }}>Date</div>
              <div className="text-xs font-medium" style={{ color: '#111' }}>{proposal.proposal_date}</div>
              <div className="text-xs uppercase mt-2" style={{ letterSpacing: '2px', color: '#aaa' }}>Valid until</div>
              <div className="text-xs font-medium" style={{ color: '#111' }}>{proposal.valid_until}</div>
            </div>
          </div>
        </div>
        {proposal.title && (
          <div className="px-10 mt-6 mb-2">
            {editable('title', proposal.title, <h2 className="text-base font-bold" style={{ color: '#111' }}>{proposal.title}</h2>)}
          </div>
        )}
        <div className="px-10 pt-4">
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
  // TEMPLATE: HERITAGE (was Classic)
  // ════════════════════════════════════════
  if (template === 'heritage') {
    const heritageBg = customHeaderStyle === 'dark' ? trade.accentColor : '#fff';
    const heritageTitleColor = customHeaderStyle === 'dark' ? '#fff' : '#111';
    const heritageProposalColor = customHeaderStyle === 'dark' ? '#fff' : trade.accentColor;
    const heritageMutedColor = customHeaderStyle === 'dark' ? 'rgba(255,255,255,0.75)' : '#666';
    const heritageSubColor = customHeaderStyle === 'dark' ? 'rgba(255,255,255,0.7)' : '#999';
    return (
      <div className="bg-white text-sm" style={{ fontFamily, minHeight: '800px', color: '#1a1a1a' }}>
        {customHeaderStyle !== 'minimal' && <div className="h-1" style={{ backgroundColor: trade.accentColor }} />}
        <div className="px-10 pt-8 pb-6" style={{ backgroundColor: heritageBg }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className={customHeaderStyle === 'dark' ? 'h-12 w-auto object-contain brightness-0 invert' : 'h-12 w-auto object-contain'} />}
              <div>
                <div style={{ fontFamily, fontSize: '22px', fontWeight: 700, color: heritageTitleColor, letterSpacing: '-0.3px' }}>{profile?.company_name || 'Company Name'}</div>
                {profile?.trade_type && <div className="text-xs uppercase mt-1" style={{ letterSpacing: '2px', color: heritageSubColor }}>{trade.label}</div>}
              </div>
            </div>
            <div className="text-right">
              <div style={{ fontFamily, fontSize: '26px', fontWeight: 700, color: heritageProposalColor }}>PROPOSAL</div>
              <div className="text-xs mt-1" style={{ color: heritageMutedColor }}>{proposalNumber}</div>
              <div className="text-xs mt-1" style={{ color: heritageMutedColor }}>Date: {proposal.proposal_date}</div>
              <div className="text-xs" style={{ color: heritageMutedColor }}>Valid until: {proposal.valid_until}</div>
            </div>
          </div>
        </div>
        <div className="mx-10" style={{ borderBottom: `1px solid ${trade.accentColor}` }} />
        <div className="px-10 py-6" style={{ borderBottom: '1px solid #eee' }}>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-xs font-bold uppercase mb-2" style={{ letterSpacing: '1px', color: '#888' }}>Bill To</div>
              <div className="text-sm font-semibold">{proposal.client_name}</div>
              {proposal.client_phone && <div className="text-xs mt-0.5" style={{ color: '#555' }}>{formatPhone(proposal.client_phone)}</div>}
              {proposal.client_email && <div className="text-xs" style={{ color: '#555' }}>{proposal.client_email}</div>}
              {jobSiteAddress && <div className="text-xs mt-1" style={{ color: '#555' }}>Job site: {jobSiteAddress}</div>}
            </div>
            <div className="text-right">
              <div className="text-xs" style={{ color: '#888' }}>Proposal No: <span className="font-semibold" style={{ color: '#111' }}>{proposalNumber}</span></div>
            </div>
          </div>
        </div>
        {proposal.title && (
          <div className="px-10 mt-6 mb-4">
            {editable('title', proposal.title, <h2 className="text-base font-bold pb-2" style={{ color: '#111', borderBottom: '1px solid #ddd', fontFamily: 'Georgia, Times New Roman, serif' }}>{proposal.title}</h2>)}
          </div>
        )}
        <div className="px-10">
          {contentSections(ClassicSection)}
          {lineItemsTable()}
          {termsAndConditions(ClassicSection)}
          {signatureBlock()}
        </div>
        <div className="mt-12 mx-10">
          <div className="h-1" style={{ backgroundColor: trade.accentColor }} />
          <div className="text-center py-4 text-xs" style={{ color: '#888' }}>
            {profile?.company_name} {profile?.phone && `• ${formatPhone(profile.phone)}`} {profile?.email && `• ${profile.email}`}
          </div>
        </div>
        {exhibitsSection()}
      </div>
    );
  }

  // ════════════════════════════════════════
  // TEMPLATE: COMMAND (was Bold)
  // ════════════════════════════════════════
  if (template === 'command') {
    return (
      <div className="bg-white text-sm" style={{ fontFamily, minHeight: '800px', color: '#1a1a1a' }}>
        {customHeaderStyle === 'dark' ? (
          <>
            <div className="px-10 py-8" style={{ backgroundColor: trade.accentColor }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-14 w-auto object-contain brightness-0 invert" />}
                  <div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{profile?.company_name || 'Company Name'}</div>
                    {profile?.trade_type && <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '3px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>{trade.label}</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: '46px', fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>PROPOSAL</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '6px' }}>{proposalNumber}</div>
                </div>
              </div>
            </div>
            <div style={{ height: '4px', backgroundColor: 'rgba(0,0,0,0.2)' }} />
            <div className="grid grid-cols-4 gap-0 px-10 py-4" style={{ backgroundColor: '#111' }}>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.35)' }}>Prepared for</div><div style={{ fontSize: '13px', fontWeight: 500, color: '#fff', marginTop: '3px' }}>{proposal.client_name}</div></div>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.35)' }}>Job site</div><div style={{ fontSize: '12px', color: '#fff', marginTop: '3px' }}>{jobSiteAddress || '—'}</div></div>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.35)' }}>Date</div><div style={{ fontSize: '12px', color: '#fff', marginTop: '3px' }}>{proposal.proposal_date}</div></div>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: 'rgba(255,255,255,0.35)' }}>Valid until</div><div style={{ fontSize: '12px', color: '#fff', marginTop: '3px' }}>{proposal.valid_until}</div></div>
            </div>
          </>
        ) : customHeaderStyle === 'light' ? (
          <>
            <div className="px-10 py-8 bg-white" style={{ borderLeft: `6px solid ${trade.accentColor}` }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-14 w-auto object-contain" />}
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: trade.accentColor, letterSpacing: '-0.5px' }}>{profile?.company_name || 'Company Name'}</div>
                    {profile?.trade_type && <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '3px', color: '#999', marginTop: '4px' }}>{trade.label}</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: '36px', fontWeight: 900, color: '#111', letterSpacing: '-1px', lineHeight: 1 }}>PROPOSAL</div>
                  <div style={{ fontSize: '13px', color: '#999', marginTop: '6px' }}>{proposalNumber}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-0 px-10 py-4" style={{ backgroundColor: `${trade.accentColor}15`, borderTop: `1px solid ${trade.accentColor}30` }}>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#999' }}>Prepared for</div><div style={{ fontSize: '13px', fontWeight: 500, color: '#111', marginTop: '3px' }}>{proposal.client_name}</div></div>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#999' }}>Job site</div><div style={{ fontSize: '12px', color: '#444', marginTop: '3px' }}>{jobSiteAddress || '—'}</div></div>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#999' }}>Date</div><div style={{ fontSize: '12px', color: '#111', marginTop: '3px' }}>{proposal.proposal_date}</div></div>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#999' }}>Valid until</div><div style={{ fontSize: '12px', color: '#111', marginTop: '3px' }}>{proposal.valid_until}</div></div>
            </div>
          </>
        ) : (
          <>
            <div className="px-10 py-8">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-14 w-auto object-contain" />}
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#111', letterSpacing: '-0.5px' }}>{profile?.company_name || 'Company Name'}</div>
                    {profile?.trade_type && <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '3px', color: '#888', marginTop: '4px' }}>{trade.label}</div>}
                  </div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '4px', color: '#999' }}>Proposal</div>
                  <div style={{ fontSize: '18px', fontWeight: 600, color: '#111', marginTop: '4px' }}>{proposalNumber}</div>
                </div>
              </div>
              <div style={{ borderBottom: `2px solid ${trade.accentColor}`, marginTop: '1.5rem' }} />
            </div>
            <div className="grid grid-cols-4 gap-0 px-10 pb-6" style={{ borderBottom: '1px solid #eee' }}>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#aaa' }}>Prepared for</div><div style={{ fontSize: '13px', fontWeight: 500, color: '#111', marginTop: '3px' }}>{proposal.client_name}</div></div>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#aaa' }}>Job site</div><div style={{ fontSize: '12px', color: '#444', marginTop: '3px' }}>{jobSiteAddress || '—'}</div></div>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#aaa' }}>Date</div><div style={{ fontSize: '12px', color: '#111', marginTop: '3px' }}>{proposal.proposal_date}</div></div>
              <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#aaa' }}>Valid until</div><div style={{ fontSize: '12px', color: '#111', marginTop: '3px' }}>{proposal.valid_until}</div></div>
            </div>
          </>
        )}
        {proposal.title && (
          <div className="px-10 mt-6 mb-4">
            {editable('title', proposal.title, <h2 style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: trade.accentColor }}>{proposal.title}</h2>)}
          </div>
        )}
        <div className="px-10 pt-2">
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
  // TEMPLATE: LINEN (was Minimal) — default fallback
  // ════════════════════════════════════════
  // LINEN template — header style variants
  const linenTopBar = customHeaderStyle === 'dark'
    ? <div style={{ height: '6px', backgroundColor: trade.accentColor }} />
    : customHeaderStyle === 'light'
      ? <div style={{ height: '1px', backgroundColor: trade.accentColor }} />
      : null;
  const linenBg = customHeaderStyle === 'dark' ? trade.accentColor : '#fff';
  const linenTitleColor = customHeaderStyle === 'dark' ? '#fff' : '#111';
  const linenSubColor = customHeaderStyle === 'dark' ? 'rgba(255,255,255,0.7)' : '#bbb';
  return (
    <div className="bg-white text-sm" style={{ fontFamily, minHeight: '800px', color: '#1a1a1a' }}>
      {linenTopBar}
      <div className="px-12 pt-12 pb-8" style={{ backgroundColor: linenBg }}>
        <div className="flex items-start justify-between">
          <div>
            {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className={customHeaderStyle === 'dark' ? 'h-10 w-auto object-contain mb-4 brightness-0 invert' : 'h-10 w-auto object-contain mb-4'} />}
            <div style={{ fontSize: '22px', fontWeight: 300, color: linenTitleColor, letterSpacing: '1px' }}>{profile?.company_name || 'Company Name'}</div>
            {profile?.trade_type && <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '3px', color: linenSubColor, marginTop: '6px' }}>{trade.label}</div>}
          </div>
          <div className="text-right">
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '4px', color: linenSubColor }}>Proposal</div>
            <div style={{ fontSize: '16px', fontWeight: 500, color: linenTitleColor, marginTop: '4px' }}>{proposalNumber}</div>
            {proposal.proposal_date && <div style={{ fontSize: '12px', color: '#bbb', marginTop: '8px' }}>{proposal.proposal_date}</div>}
          </div>
        </div>
      </div>
      <div className="mx-12" style={{ borderBottom: '1px solid #f0f0f0' }} />
      <div className="px-12 py-8" style={{ borderBottom: '1px solid #f0f0f0' }}>
        <div className="grid grid-cols-4 gap-4">
          <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#ccc' }}>Prepared for</div><div style={{ fontSize: '13px', color: '#111', marginTop: '4px' }}>{proposal.client_name}</div></div>
          <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#ccc' }}>Job site</div><div style={{ fontSize: '12px', color: '#555', marginTop: '4px' }}>{jobSiteAddress || '—'}</div></div>
          <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#ccc' }}>Date</div><div style={{ fontSize: '12px', color: '#111', marginTop: '4px' }}>{proposal.proposal_date}</div></div>
          <div><div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '2px', color: '#ccc' }}>Valid until</div><div style={{ fontSize: '12px', color: '#111', marginTop: '4px' }}>{proposal.valid_until}</div></div>
        </div>
      </div>
      {proposal.title && (
        <div className="px-12 mt-8 mb-4">
          {editable('title', proposal.title, <h2 style={{ fontSize: '15px', fontWeight: 500, color: '#111' }}>{proposal.title}</h2>)}
        </div>
      )}
      <div className="px-12 pt-4">
        {contentSections(MinimalSection)}
        {lineItemsTable()}
        {termsAndConditions(MinimalSection)}
        {signatureBlock()}
      </div>
      <div className="mt-12 mx-12">
        <div style={{ borderTop: '1px solid #f0f0f0' }} />
        <div className="flex justify-center gap-8 py-5 text-xs" style={{ color: '#bbb' }}>
          {profile?.phone && <span>{formatPhone(profile.phone)}</span>}
          {profile?.email && <span>{profile.email}</span>}
          {profile?.website && <span>{profile.website}</span>}
        </div>
      </div>
      {exhibitsSection()}
    </div>
  );

  // ─── Sub-components ───
  function ModernSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="mb-6">
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, color: trade.accentColor, marginBottom: '8px' }}>{title}</div>
        {children}
      </div>
    );
  }

  function ClassicSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="mb-6">
        <h3 style={{ fontFamily, fontSize: '15px', fontWeight: 700, color: '#111', borderBottom: '1px solid #eee', paddingBottom: '4px', marginBottom: '8px' }}>{title}</h3>
        {children}
      </div>
    );
  }

  function BoldSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="mb-6">
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 700, color: trade.accentColor, marginBottom: '6px' }}>{title}</div>
        <div style={{ borderLeft: `3px solid ${trade.accentColor}`, paddingLeft: '1rem' }}>
          {children}
        </div>
      </div>
    );
  }

  function MinimalSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="mb-10">
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '3px', fontWeight: 400, color: '#bbb', marginBottom: '10px' }}>{title}</div>
        {children}
      </div>
    );
  }
}

