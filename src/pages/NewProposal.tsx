import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProposals } from '@/hooks/useProposals';
import { useSubscription } from '@/hooks/useSubscription';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import AppLayout from '@/components/AppLayout';
import TemplateSelector from '@/components/proposal/TemplateSelector';
import ProposalForm from '@/components/proposal/ProposalForm';
import UpgradePrompt from '@/components/proposal/UpgradePrompt';
import { useToast } from '@/hooks/use-toast';

export type ProposalTemplate = 'classic' | 'modern' | 'minimal' | 'bold' | 'executive' | 'contractor' | 'premium' | 'clean';

export interface LineItemData {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export interface ProposalFormData {
  template: ProposalTemplate;
  client_name: string;
  client_email: string;
  client_phone: string;
  job_site_street: string;
  job_site_city: string;
  job_site_state: string;
  job_site_zip: string;
  title: string;
  job_description: string;
  scope_of_work: string;
  materials_included: string;
  materials_excluded: string;
  estimated_start_date: string;
  estimated_duration: string;
  line_items: LineItemData[];
  tax_rate: number;
  deposit_mode: 'percentage' | 'flat';
  deposit_value: number;
  payment_terms: string;
  accepted_payment_methods: string[];
  warranty_terms: string;
  disclosures: string;
  special_conditions: string;
  proposal_date: string;
  valid_until: string;
  delivery_method: 'email_self' | 'email_client';
}

export default function NewProposal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { createProposal, isCreating } = useProposals();
  const { subscription, canCreateProposal, isLoading: subLoading, incrementProposalCount } = useSubscription();
  const { profile } = useCompanyProfile();
  const [step, setStep] = useState<'template' | 'form'>(() => {
    try {
      const saved = localStorage.getItem('ezbid_proposal_draft');
      if (saved) return 'form';
    } catch {}
    return 'template';
  });
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate>(() => {
    try {
      const saved = localStorage.getItem('ezbid_proposal_draft');
      if (saved) return JSON.parse(saved).template || 'classic';
    } catch {}
    return 'classic';
  });

  // Only show upgrade after subscription data has loaded and user truly can't create
  const [dismissed, setDismissed] = useState(false);
  const showUpgrade = !subLoading && !canCreateProposal && !dismissed;

  if (showUpgrade) {
    return (
      <AppLayout>
        <UpgradePrompt
          proposalsUsed={subscription?.proposals_used ?? 0}
          onContinue={() => setDismissed(true)}
        />
      </AppLayout>
    );
  }

  const handleTemplateSelect = (template: ProposalTemplate) => {
    setSelectedTemplate(template);
    setStep('form');
  };

  const handleSubmit = async (data: ProposalFormData) => {
    try {
      const subtotal = data.line_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const taxAmount = subtotal * (data.tax_rate / 100);
      const total = subtotal + taxAmount;
      const depositAmount = data.deposit_mode === 'percentage'
        ? total * (data.deposit_value / 100)
        : data.deposit_value;
      const balanceDue = total - depositAmount;

      const proposal = await createProposal({
        template: data.template,
        client_name: data.client_name,
        client_email: data.client_email,
        client_phone: data.client_phone || null,
        job_site_street: data.job_site_street,
        job_site_city: data.job_site_city,
        job_site_state: data.job_site_state,
        job_site_zip: data.job_site_zip,
        title: data.title,
        job_description: data.job_description,
        scope_of_work: data.scope_of_work,
        materials_included: data.materials_included,
        materials_excluded: data.materials_excluded || null,
        estimated_start_date: data.estimated_start_date || null,
        estimated_duration: data.estimated_duration,
        subtotal,
        tax_rate: data.tax_rate,
        tax_amount: taxAmount,
        total,
        deposit_mode: data.deposit_mode,
        deposit_value: data.deposit_value,
        deposit_amount: depositAmount,
        balance_due: balanceDue,
        payment_terms: data.payment_terms,
        accepted_payment_methods: data.accepted_payment_methods,
        warranty_terms: data.warranty_terms,
        disclosures: data.disclosures,
        special_conditions: data.special_conditions || null,
        proposal_date: data.proposal_date,
        valid_until: data.valid_until,
        delivery_method: data.delivery_method,
        status: 'draft',
      });

      // Save line items
      if (data.line_items.length > 0) {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.from('proposal_line_items').insert(
          data.line_items.map((item, i) => ({
            proposal_id: proposal.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            subtotal: item.quantity * item.unit_price,
            sort_order: i,
          }))
        );
      }

      await incrementProposalCount();
      localStorage.removeItem('ezbid_proposal_draft');
      toast({ title: 'Proposal created as draft' });
      navigate(`/proposals/${proposal.id}/preview`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-4xl px-4 py-8 animate-fade-in">
        {step === 'template' ? (
          <TemplateSelector
            selected={selectedTemplate}
            brandColor={profile?.brand_color || '#000000'}
            onSelect={handleTemplateSelect}
          />
        ) : (
          <ProposalForm
            template={selectedTemplate}
            profile={profile}
            onSubmit={handleSubmit}
            isSubmitting={isCreating}
            onBack={() => setStep('template')}
          />
        )}
      </div>
    </AppLayout>
  );
}
