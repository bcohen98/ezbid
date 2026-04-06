import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2 } from 'lucide-react';
import { useProposals } from '@/hooks/useProposals';
import { useSubscription } from '@/hooks/useSubscription';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import UpgradePrompt from '@/components/proposal/UpgradePrompt';
import TradeSelector, { type TradeType } from '@/components/proposal/TradeSelector';
import LineItemsTable, { type LineItem, makeDefaults } from '@/components/proposal/LineItemsTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function NewProposal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { createProposal, isCreating } = useProposals();
  const { subscription, canCreateProposal, isLoading: subLoading, incrementProposalCount } = useSubscription();
  const { profile } = useCompanyProfile();

  // Trade
  const defaultTrade = (profile?.trade_type as TradeType) || 'general_contractor';
  const [trade, setTrade] = useState<TradeType>(defaultTrade);

  // Client / Job
  const [clientName, setClientName] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  // Line items
  const [items, setItems] = useState<LineItem[]>(() => makeDefaults(defaultTrade));

  // Tax & Discount
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountMode, setDiscountMode] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState(0);

  const [isGenerating, setIsGenerating] = useState(false);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);
  const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
  const discountAmount = discountEnabled
    ? discountMode === 'percentage' ? subtotal * (discountValue / 100) : discountValue
    : 0;
  const grandTotal = subtotal + taxAmount - discountAmount;

  const showUpgrade = !subLoading && !canCreateProposal;

  if (showUpgrade) {
    return (
      <AppLayout>
        <UpgradePrompt
          proposalsUsed={subscription?.proposals_used ?? 0}
          onContinue={() => navigate('/dashboard')}
        />
      </AppLayout>
    );
  }

  const handleBuildProposal = async () => {
    if (!clientName.trim()) {
      toast({ title: 'Client name is required', variant: 'destructive' });
      return;
    }
    if (!jobDescription.trim()) {
      toast({ title: 'Please describe the job', variant: 'destructive' });
      return;
    }
    if (items.length === 0 || items.every(i => !i.description.trim())) {
      toast({ title: 'Add at least one line item', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      // 1. Call AI to generate proposal content
      const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-proposal', {
        body: {
          trade,
          client_name: clientName,
          job_address: jobAddress,
          job_description: jobDescription,
          line_items: items.filter(i => i.description.trim()),
          subtotal,
          tax_amount: taxAmount,
          discount_amount: discountAmount,
          grand_total: grandTotal,
          company: profile,
        },
      });

      if (aiError) throw new Error(aiError.message || 'AI generation failed');
      if (aiData?.error) throw new Error(aiData.error);

      // 2. Save proposal to DB
      const proposal = await createProposal({
        template: 'clean' as any,
        client_name: clientName,
        client_email: null,
        client_phone: null,
        job_site_street: jobAddress,
        job_site_city: null,
        job_site_state: null,
        job_site_zip: null,
        title: aiData.title || `${trade.replace(/_/g, ' ')} Proposal`,
        job_description: aiData.cover_letter || jobDescription,
        scope_of_work: aiData.scope_of_work || '',
        materials_included: aiData.materials_included || '',
        materials_excluded: aiData.materials_excluded || null,
        estimated_start_date: null,
        estimated_duration: aiData.project_timeline || '',
        subtotal,
        tax_rate: taxEnabled ? taxRate : 0,
        tax_amount: taxAmount,
        total: grandTotal,
        deposit_mode: 'percentage' as any,
        deposit_value: 0,
        deposit_amount: 0,
        balance_due: grandTotal,
        payment_terms: aiData.payment_terms || '',
        accepted_payment_methods: [],
        warranty_terms: aiData.warranty_terms || '',
        disclosures: aiData.disclosures || '',
        special_conditions: aiData.special_conditions || null,
        proposal_date: new Date().toISOString().split('T')[0],
        valid_until: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        delivery_method: 'email_self',
        status: 'draft' as any,
      });

      // 3. Save line items
      const validItems = items.filter(i => i.description.trim());
      if (validItems.length > 0) {
        await supabase.from('proposal_line_items').insert(
          validItems.map((item, i) => ({
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
      toast({ title: 'Proposal generated!' });
      navigate(`/proposals/${proposal.id}/preview`);
    } catch (err: any) {
      console.error('Generate proposal error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-4xl px-4 py-8 animate-fade-in space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Proposal</h1>
          <p className="text-muted-foreground mt-1">Select your trade, describe the job, add your quote, and let AI build a professional proposal.</p>
        </div>

        {/* Step 1: Trade */}
        <TradeSelector selected={trade} onSelect={setTrade} />

        {/* Step 2: Job Info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Job Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Client Name</label>
              <Input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="John Smith"
                className="h-12"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Job Address</label>
              <Input
                value={jobAddress}
                onChange={e => setJobAddress(e.target.value)}
                placeholder="123 Main St, City, State"
                className="h-12"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Job Description</label>
            <Textarea
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              placeholder="Describe the job in your own words. What needs to be done, what materials are you using, any special details, timeline, warranty — anything relevant."
              rows={5}
              className="text-base"
            />
          </div>
        </div>

        {/* Step 3: Line Items */}
        <LineItemsTable
          trade={trade}
          items={items}
          onChange={setItems}
          taxEnabled={taxEnabled}
          taxRate={taxRate}
          discountEnabled={discountEnabled}
          discountMode={discountMode}
          discountValue={discountValue}
          onTaxToggle={setTaxEnabled}
          onTaxRateChange={setTaxRate}
          onDiscountToggle={setDiscountEnabled}
          onDiscountModeChange={setDiscountMode}
          onDiscountValueChange={setDiscountValue}
        />

        {/* Step 4: Build */}
        <div className="pt-4 pb-8">
          <Button
            onClick={handleBuildProposal}
            disabled={isGenerating || isCreating}
            className="w-full h-14 text-lg font-semibold"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Building Your Proposal…
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Build Proposal with AI
              </>
            )}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
