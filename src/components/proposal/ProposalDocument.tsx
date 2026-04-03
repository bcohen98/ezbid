import type { Database } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/formatCurrency';
import EditableSection, { EditableLineItemRow, EditableTotals } from './EditableSection';

type Proposal = Database['public']['Tables']['proposals']['Row'];
type LineItem = Database['public']['Tables']['proposal_line_items']['Row'];
type CompanyProfile = Database['public']['Tables']['company_profiles']['Row'];

interface Props {
  proposal: Proposal;
  lineItems: LineItem[];
  profile: CompanyProfile | null | undefined;
  onFieldEdit?: (field: string, value: string) => void;
  onLineItemEdit?: (id: string, updates: { description: string; quantity: number; unit: string; unit_price: number; subtotal: number }) => void;
}

export default function ProposalDocument({ proposal, lineItems, profile, onFieldEdit, onLineItemEdit }: Props) {
  const template = proposal.template || 'classic';
  const brandColor = profile?.brand_color || '#000000';

  const editable = (field: string, value: string | null, children: React.ReactNode) => {
    if (!onFieldEdit || !value) return children;
    return (
      <EditableSection field={field} value={value} onSave={onFieldEdit}>
        {children}
      </EditableSection>
    );
  };

  return (
    <div className="p-8 text-sm" style={{ fontFamily: "'Inter', sans-serif", minHeight: '800px' }}>
      {/* Header */}
      {template === 'classic' && (
        <div className="rounded-md p-4 mb-6" style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
          <div className="flex items-start justify-between">
            <div>
              {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-10 mb-2 brightness-0 invert" />}
              <div className="font-semibold text-base">{profile?.company_name || 'Company Name'}</div>
              <div className="text-xs opacity-70 mt-1">
                {[profile?.street_address, profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ')}
              </div>
              {profile?.phone && <div className="text-xs opacity-70">{profile.phone}</div>}
              {profile?.email && <div className="text-xs opacity-70">{profile.email}</div>}
              {profile?.license_numbers?.length ? <div className="text-xs opacity-70 mt-1">Lic# {profile.license_numbers.join(', ')}</div> : null}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tracking-tight">PROPOSAL</div>
              <div className="text-xs opacity-70 mt-1">PRO-{String(proposal.proposal_number).padStart(4, '0')}</div>
            </div>
          </div>
        </div>
      )}

      {template === 'modern' && (
        <>
          <div className="h-2 rounded-full mb-6" style={{ backgroundColor: brandColor }} />
          <div className="flex items-start justify-between mb-6">
            <div>
              {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-10 mb-2" />}
              <div className="font-semibold text-base" style={{ color: brandColor }}>{profile?.company_name || 'Company Name'}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {[profile?.street_address, profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ')}
              </div>
              {profile?.phone && <div className="text-xs text-muted-foreground">{profile.phone}</div>}
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold tracking-tight" style={{ color: brandColor }}>PROPOSAL</div>
              <div className="text-xs text-muted-foreground mt-1">PRO-{String(proposal.proposal_number).padStart(4, '0')}</div>
            </div>
          </div>
        </>
      )}

      {template === 'minimal' && (
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-8 mb-2" />}
              <div className="text-xl font-semibold tracking-tight">{profile?.company_name || 'Company Name'}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {[profile?.street_address, profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Proposal</div>
              <div className="text-xs text-muted-foreground">PRO-{String(proposal.proposal_number).padStart(4, '0')}</div>
            </div>
          </div>
        </div>
      )}

      {template === 'bold' && (
        <div className="mb-6">
          <div className="border-l-4 pl-4 py-2" style={{ borderColor: brandColor }}>
            {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-10 mb-2" />}
            <div className="text-xl font-bold uppercase tracking-wide">{profile?.company_name || 'Company Name'}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {[profile?.street_address, profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ')}
            </div>
            {profile?.phone && <div className="text-xs text-muted-foreground">{profile.phone}</div>}
          </div>
          <div className="flex justify-between items-end mt-4">
            <div className="text-3xl font-black uppercase tracking-tighter" style={{ color: brandColor }}>Proposal</div>
            <div className="text-xs text-muted-foreground">PRO-{String(proposal.proposal_number).padStart(4, '0')}</div>
          </div>
        </div>
      )}

      {template === 'executive' && (
        <div className="mb-6">
          <div className="flex items-start justify-between border-b-2 pb-4" style={{ borderColor: brandColor }}>
            <div>
              {profile?.logo_url && <img src={profile.logo_url} alt="Logo" className="h-12 mb-2" />}
              <div className="text-lg font-semibold">{profile?.company_name || 'Company Name'}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {[profile?.street_address, profile?.city, profile?.state, profile?.zip].filter(Boolean).join(', ')}
              </div>
              {profile?.phone && <div className="text-xs text-muted-foreground">{profile.phone}</div>}
              {profile?.email && <div className="text-xs text-muted-foreground">{profile.email}</div>}
              {profile?.license_numbers?.length ? <div className="text-xs text-muted-foreground mt-1">License: {profile.license_numbers.join(', ')}</div> : null}
            </div>
            <div className="text-right">
              <div className="text-sm uppercase tracking-widest text-muted-foreground">Professional Proposal</div>
              <div className="text-xs text-muted-foreground mt-1">No. PRO-{String(proposal.proposal_number).padStart(4, '0')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Dates & Client */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <SectionHeading template={template} color={brandColor}>Client</SectionHeading>
          <div className="text-sm mt-1">{proposal.client_name}</div>
          {proposal.client_email && <div className="text-xs text-muted-foreground">{proposal.client_email}</div>}
          {proposal.client_phone && <div className="text-xs text-muted-foreground">{proposal.client_phone}</div>}
          {proposal.job_site_street && (
            <div className="text-xs text-muted-foreground mt-1">
              {proposal.job_site_street}, {proposal.job_site_city}, {proposal.job_site_state} {proposal.job_site_zip}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Date: {proposal.proposal_date}</div>
          <div className="text-xs text-muted-foreground">Valid until: {proposal.valid_until}</div>
        </div>
      </div>

      {/* Title */}
      {proposal.title && editable('title', proposal.title,
        <h2 className="text-lg font-semibold mb-4">{proposal.title}</h2>
      )}

      {/* Job Description */}
      {(proposal.enhanced_job_description || proposal.job_description) && (
        <div className="mb-4">
          <SectionHeading template={template} color={brandColor}>Job Description</SectionHeading>
          {editable('job_description', proposal.enhanced_job_description || proposal.job_description,
            <p className="text-sm mt-1 whitespace-pre-wrap">{proposal.enhanced_job_description || proposal.job_description}</p>
          )}
        </div>
      )}

      {/* Scope of Work */}
      {(proposal.enhanced_scope_of_work || proposal.scope_of_work) && (
        <div className="mb-4">
          <SectionHeading template={template} color={brandColor}>Scope of Work</SectionHeading>
          {editable('scope_of_work', proposal.enhanced_scope_of_work || proposal.scope_of_work,
            <p className="text-sm mt-1 whitespace-pre-wrap">{proposal.enhanced_scope_of_work || proposal.scope_of_work}</p>
          )}
        </div>
      )}

      {/* Materials */}
      {proposal.materials_included && (
        <div className="mb-4">
          <SectionHeading template={template} color={brandColor}>Materials Included</SectionHeading>
          {editable('materials_included', proposal.materials_included,
            <p className="text-sm mt-1 whitespace-pre-wrap">{proposal.materials_included}</p>
          )}
        </div>
      )}
      {proposal.materials_excluded && (
        <div className="mb-4">
          <SectionHeading template={template} color={brandColor}>Materials Excluded</SectionHeading>
          {editable('materials_excluded', proposal.materials_excluded,
            <p className="text-sm mt-1 whitespace-pre-wrap">{proposal.materials_excluded}</p>
          )}
        </div>
      )}

      {/* Timeline */}
      {(proposal.estimated_start_date || proposal.estimated_duration) && (
        <div className="mb-4">
          <SectionHeading template={template} color={brandColor}>Timeline</SectionHeading>
          <div className="text-sm mt-1">
            {proposal.estimated_start_date && <div>Start date: {proposal.estimated_start_date}</div>}
            {proposal.estimated_duration && editable('estimated_duration', proposal.estimated_duration,
              <div>Duration: {proposal.estimated_duration}</div>
            )}
          </div>
        </div>
      )}

      {/* Line Items Table */}
      {lineItems.length > 0 && (
        <div className="mb-4">
          <SectionHeading template={template} color={brandColor}>Pricing</SectionHeading>
          <table className="w-full mt-2 text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2 w-16">Qty</th>
                <th className="text-right py-2 w-16">Unit</th>
                <th className="text-right py-2 w-24">Unit Price</th>
                <th className="text-right py-2 w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                onLineItemEdit ? (
                  <EditableLineItemRow key={item.id} item={item} onSave={onLineItemEdit} />
                ) : (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.description}</td>
                    <td className="text-right py-2">{item.quantity}</td>
                    <td className="text-right py-2">{item.unit}</td>
                    <td className="text-right py-2">${formatCurrency(item.unit_price)}</td>
                    <td className="text-right py-2">${formatCurrency(item.subtotal)}</td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
          <div className="border-t pt-2 mt-0 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${formatCurrency(proposal.subtotal)}</span></div>
            {Number(proposal.tax_rate) > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Tax ({proposal.tax_rate}%)</span><span>${formatCurrency(proposal.tax_amount)}</span></div>
            )}
            <div className="flex justify-between font-semibold text-base border-t pt-1"><span>Total</span><span>${formatCurrency(proposal.total)}</span></div>
            {Number(proposal.deposit_amount) > 0 && (
              <>
                <div className="flex justify-between text-muted-foreground"><span>Deposit required</span><span>${formatCurrency(proposal.deposit_amount)}</span></div>
                <div className="flex justify-between font-medium"><span>Balance due</span><span>${formatCurrency(proposal.balance_due)}</span></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Payment Terms */}
      {proposal.payment_terms && (
        <div className="mb-4">
          <SectionHeading template={template} color={brandColor}>Payment Terms</SectionHeading>
          {editable('payment_terms', proposal.payment_terms,
            <p className="text-sm mt-1">{proposal.payment_terms}</p>
          )}
          {proposal.accepted_payment_methods?.length ? (
            <p className="text-xs text-muted-foreground mt-1">Accepted: {proposal.accepted_payment_methods.join(', ')}</p>
          ) : null}
        </div>
      )}

      {/* Warranty */}
      {proposal.warranty_terms && (
        <div className="mb-4">
          <SectionHeading template={template} color={brandColor}>Warranty</SectionHeading>
          {editable('warranty_terms', proposal.warranty_terms,
            <p className="text-sm mt-1 whitespace-pre-wrap">{proposal.warranty_terms}</p>
          )}
        </div>
      )}

      {/* Disclosures */}
      {proposal.disclosures && (
        <div className="mb-4">
          <SectionHeading template={template} color={brandColor}>Disclosures</SectionHeading>
          {editable('disclosures', proposal.disclosures,
            <p className="text-sm mt-1 whitespace-pre-wrap">{proposal.disclosures}</p>
          )}
        </div>
      )}

      {/* Special Conditions */}
      {proposal.special_conditions && (
        <div className="mb-4">
          <SectionHeading template={template} color={brandColor}>Special Conditions</SectionHeading>
          {editable('special_conditions', proposal.special_conditions,
            <p className="text-sm mt-1 whitespace-pre-wrap">{proposal.special_conditions}</p>
          )}
        </div>
      )}

      {/* Signature Block */}
      <div className="mt-12 grid grid-cols-2 gap-12">
        <div>
          <div className="border-b mb-1 pb-8"></div>
          <div className="text-xs text-muted-foreground">Client Signature</div>
          <div className="text-xs text-muted-foreground mt-1">Date: _______________</div>
        </div>
        <div>
          <div className="border-b mb-1 pb-8"></div>
          <div className="text-xs text-muted-foreground">Contractor Signature</div>
          <div className="text-xs text-muted-foreground mt-1">Date: _______________</div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t text-xs text-muted-foreground text-center">
        {profile?.company_name} {profile?.license_numbers?.length ? `· Lic# ${profile.license_numbers.join(', ')}` : ''}
      </div>
    </div>
  );
}

function SectionHeading({ template, color, children }: { template: string; color: string; children: React.ReactNode }) {
  if (template === 'modern') {
    return <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color }}>{children}</h3>;
  }
  if (template === 'minimal') {
    return <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</h3>;
  }
  if (template === 'bold') {
    return <h3 className="text-sm font-bold uppercase tracking-wide border-b pb-1 mb-1" style={{ borderColor: color, color }}>{children}</h3>;
  }
  if (template === 'executive') {
    return <h3 className="text-sm font-semibold tracking-tight border-b pb-1 mb-1">{children}</h3>;
  }
  // Classic
  return <h3 className="text-sm font-semibold">{children}</h3>;
}
