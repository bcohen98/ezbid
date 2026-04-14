import { useState, useMemo } from 'react';
import { trackEvent } from '@/lib/trackEvent';

// Legacy type exports used by ProposalForm and TemplateSelector
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

import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, X, Check } from 'lucide-react';
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

interface AiSuggestion {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  reason: string;
  accepted: boolean;
}

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

  // Materials (populated by AI suggest)
  const [materialsIncluded, setMaterialsIncluded] = useState('');
  const [materialsExcluded, setMaterialsExcluded] = useState('');
  const [isSuggestingMaterials, setIsSuggestingMaterials] = useState(false);

  // Line items
  const [items, setItems] = useState<LineItem[]>(() => makeDefaults(defaultTrade));

  // Tax, Discount, Deposit
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountMode, setDiscountMode] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState(0);
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositMode, setDepositMode] = useState<'flat' | 'percentage'>('percentage');
  const [depositValue, setDepositValue] = useState(50);

  // AI suggestion review step
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);
  const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
  const discountAmount = discountEnabled
    ? discountMode === 'percentage' ? subtotal * (discountValue / 100) : discountValue
    : 0;
  const grandTotal = subtotal + taxAmount - discountAmount;
  const depositAmount = depositEnabled
    ? depositMode === 'percentage' ? grandTotal * (depositValue / 100) : depositValue
    : 0;
  const balanceDue = grandTotal - depositAmount;

  const showUpgrade = !subLoading && !canCreateProposal;

  if (showUpgrade) {
    return (
      <AppLayout>
        <UpgradePrompt
          proposalsUsed={subscription?.proposals_used ?? 0}
          onContinue={() => navigate('/dashboard')}
          source="new_proposal"
        />
      </AppLayout>
    );
  }

  const validate = () => {
    const missing: string[] = [];
    if (!clientName.trim()) missing.push('Client Name');
    if (!jobAddress.trim()) missing.push('Job Address');
    if (!jobDescription.trim()) missing.push('Job Description');
    if (missing.length > 0) {
      toast({ title: 'Missing required fields', description: `Please fill in: ${missing.join(', ')}`, variant: 'destructive' });
      return false;
    }
    if (items.length === 0 || items.every(i => !i.description.trim())) {
      toast({ title: 'Add at least one line item', variant: 'destructive' });
      return false;
    }
    return true;
  };

  // Step 1: Get AI suggestions before generating proposal
  const handleBuildClick = async () => {
    if (!validate()) return;
    trackEvent('proposal_started', { trade });

    setIsSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-line-items', {
        body: {
          trade,
          job_description: jobDescription,
          existing_items: items.filter(i => i.description.trim()),
        },
      });

      if (error) throw error;

      const sug = data?.suggestions || [];
      if (sug.length > 0) {
        setSuggestions(sug.map((s: any) => ({ ...s, accepted: true })));
        setShowSuggestions(true);
      } else {
        // No suggestions — go straight to generate
        await generateProposal(items);
      }
    } catch (err: any) {
      console.error('Suggestion error:', err);
      // On error, skip suggestions and generate directly
      await generateProposal(items);
    } finally {
      setIsSuggesting(false);
    }
  };

  // Step 2: Accept suggestions and generate
  const handleAcceptSuggestions = async () => {
    const accepted = suggestions.filter(s => s.accepted);
    let idCounter = Date.now();
    const newItems: LineItem[] = accepted.map(s => ({
      id: `ai_${idCounter++}`,
      description: s.description,
      quantity: s.quantity,
      unit: s.unit,
      unit_price: s.unit_price,
      aiSuggested: true,
    }));

    const allItems = [...items, ...newItems];
    setItems(allItems);
    setShowSuggestions(false);
    setSuggestions([]);
    await generateProposal(allItems);
  };

  const handleSkipSuggestions = async () => {
    setShowSuggestions(false);
    setSuggestions([]);
    await generateProposal(items);
  };

  const generateProposal = async (finalItems: LineItem[]) => {
    setIsGenerating(true);
    try {
      const finalSubtotal = finalItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const finalTax = taxEnabled ? finalSubtotal * (taxRate / 100) : 0;
      const finalDiscount = discountEnabled
        ? discountMode === 'percentage' ? finalSubtotal * (discountValue / 100) : discountValue
        : 0;
      const finalGrandTotal = finalSubtotal + finalTax - finalDiscount;
      const finalDepositAmount = depositEnabled
        ? depositMode === 'percentage' ? finalGrandTotal * (depositValue / 100) : depositValue
        : 0;
      const finalBalance = finalGrandTotal - finalDepositAmount;

      const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-proposal', {
        body: {
          trade,
          client_name: clientName,
          job_address: jobAddress,
          job_description: jobDescription,
          line_items: finalItems.filter(i => i.description.trim()),
          subtotal: finalSubtotal,
          tax_amount: finalTax,
          discount_amount: finalDiscount,
          grand_total: finalGrandTotal,
          deposit_amount: finalDepositAmount,
          deposit_label: depositEnabled
            ? `${depositMode === 'percentage' ? `${depositValue}%` : `$${depositValue.toFixed(2)}`} due upon signing`
            : null,
          balance_due: finalBalance,
          company: profile,
        },
      });

      if (aiError) throw new Error(aiError.message || 'AI generation failed');
      if (aiData?.error) throw new Error(aiData.error);

      const proposal = await createProposal({
        template: 'clean' as any,
        trade_type: trade as any,
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
        materials_included: materialsIncluded || aiData.materials_included || '',
        materials_excluded: materialsExcluded || aiData.materials_excluded || null,
        estimated_start_date: null,
        estimated_duration: aiData.project_timeline || '',
        subtotal: finalSubtotal,
        tax_rate: taxEnabled ? taxRate : 0,
        tax_amount: finalTax,
        total: finalGrandTotal,
        deposit_mode: depositEnabled ? depositMode as any : 'percentage' as any,
        deposit_value: depositEnabled ? depositValue : 0,
        deposit_amount: finalDepositAmount,
        balance_due: finalBalance,
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

      const validItems = finalItems.filter(i => i.description.trim());
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

      // EMAIL 3: If this was their 3rd (last free) proposal, send free_limit email
      if (subscription && subscription.status !== 'active' && subscription.proposals_used === 2) {
        try {
          if (user?.id && user?.email) {
            await supabase.functions.invoke('send-lifecycle-email', {
              body: {
                email_type: 'free_limit',
                user_id: user.id,
                recipient_email: user.email,
                first_name: profile?.owner_name,
              },
            });
          }
        } catch {
          // Non-blocking
        }
      }

      toast({ title: 'Proposal generated!' });
      trackEvent('proposal_generated', { trade });
      navigate(`/proposals/${proposal.id}/preview`);
    } catch (err: any) {
      console.error('Generate proposal error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const isWorking = isSuggesting || isGenerating;

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

        {/* AI Suggest Materials & Pricing */}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isSuggestingMaterials}
            onClick={async () => {
              setIsSuggestingMaterials(true);
              try {
                const { data, error } = await supabase.functions.invoke('suggest-materials-pricing', {
                  body: {
                    trade_type: trade,
                    job_description: jobDescription,
                    job_site_address: jobAddress || null,
                  },
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                const aiItems: LineItem[] = (data.line_items || []).map((li: any, i: number) => ({
                  id: `ai_mat_${Date.now()}_${i}`,
                  description: li.description,
                  quantity: li.quantity,
                  unit: li.unit,
                  unit_price: li.unit_price,
                  aiSuggested: true,
                }));

                // Line items
                const hasExistingItems = items.some(i => i.description.trim() && i.unit_price > 0);
                if (hasExistingItems && aiItems.length > 0) {
                  if (window.confirm('This will add suggested line items to your existing table. Continue?')) {
                    setItems(prev => [...prev, ...aiItems]);
                  }
                } else if (aiItems.length > 0) {
                  setItems(aiItems);
                }

                // Materials included
                if (data.materials_included) {
                  if (materialsIncluded.trim() && !window.confirm('This will replace your current materials list. Continue?')) {
                    // skip
                  } else {
                    setMaterialsIncluded(data.materials_included);
                  }
                }

                // Materials excluded
                if (data.materials_excluded) {
                  if (materialsExcluded.trim() && !window.confirm('This will replace your current materials excluded list. Continue?')) {
                    // skip
                  } else {
                    setMaterialsExcluded(data.materials_excluded);
                  }
                }

                toast({ title: 'Suggestions applied!', description: 'Review and adjust the line items and materials as needed.' });
              } catch (err: any) {
                toast({ title: 'Suggestion failed', description: err.message || 'Could not get AI suggestions', variant: 'destructive' });
              } finally {
                setIsSuggestingMaterials(false);
              }
            }}
          >
            {isSuggestingMaterials ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isSuggestingMaterials ? 'Suggesting…' : 'Suggest Materials & Pricing'}
          </Button>
        </div>

        {/* Materials fields */}
        {(materialsIncluded || materialsExcluded) && (
          <div className="space-y-4">
            {materialsIncluded && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Materials Included</label>
                <Textarea
                  value={materialsIncluded}
                  onChange={e => setMaterialsIncluded(e.target.value)}
                  rows={3}
                  className="text-base"
                />
              </div>
            )}
            {materialsExcluded && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Materials Excluded</label>
                <Textarea
                  value={materialsExcluded}
                  onChange={e => setMaterialsExcluded(e.target.value)}
                  rows={3}
                  className="text-base"
                />
              </div>
            )}
          </div>
        )}

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
          depositEnabled={depositEnabled}
          depositMode={depositMode}
          depositValue={depositValue}
          onTaxToggle={setTaxEnabled}
          onTaxRateChange={setTaxRate}
          onDiscountToggle={setDiscountEnabled}
          onDiscountModeChange={setDiscountMode}
          onDiscountValueChange={setDiscountValue}
          onDepositToggle={setDepositEnabled}
          onDepositModeChange={setDepositMode}
          onDepositValueChange={setDepositValue}
        />

        {/* AI Suggestions Review */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="border-2 border-blue-200 rounded-lg p-5 bg-blue-50/30 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-foreground">AI-Suggested Line Items</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Based on your job description, we found items that may be missing from your quote. Review and uncheck any you don't want.
            </p>
            <div className="space-y-2">
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-background"
                >
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...suggestions];
                      updated[idx] = { ...updated[idx], accepted: !updated[idx].accepted };
                      setSuggestions(updated);
                    }}
                    className={`mt-0.5 shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                      s.accepted ? 'bg-foreground border-foreground text-background' : 'border-border'
                    }`}
                  >
                    {s.accepted && <Check className="h-3 w-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{s.description}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {s.quantity} {s.unit} · {s.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleAcceptSuggestions} disabled={isGenerating} className="flex-1 h-12">
                {isGenerating ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Building…</>
                ) : (
                  <><Check className="h-4 w-4 mr-2" /> Accept & Build Proposal</>
                )}
              </Button>
              <Button variant="outline" onClick={handleSkipSuggestions} disabled={isGenerating} className="h-12">
                Skip
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Build */}
        {!showSuggestions && (
          <div className="pt-4 pb-8">
            <Button
              onClick={handleBuildClick}
              disabled={isWorking || isCreating}
              className="w-full h-14 text-lg font-semibold"
              size="lg"
            >
              {isSuggesting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Analyzing Your Quote…
                </>
              ) : isGenerating ? (
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
        )}
      </div>
    </AppLayout>
  );
}
