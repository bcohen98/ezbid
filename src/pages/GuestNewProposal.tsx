import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Loader2, Check } from 'lucide-react';
import TradeSelector, { type TradeType } from '@/components/proposal/TradeSelector';
import LineItemsTable, { type LineItem, makeDefaults } from '@/components/proposal/LineItemsTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logGuestProposalEvent } from '@/hooks/usePageTracking';
import EZBidLogo from '@/components/EZBidLogo';
import { useAuth } from '@/hooks/useAuth';

interface AiSuggestion {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  reason: string;
  accepted: boolean;
}

export default function GuestNewProposal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  // Redirect logged-in users to normal flow
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/proposals/new', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Enforce one guest proposal limit (localStorage + IP)
  useEffect(() => {
    const hasCreated = localStorage.getItem('ezbid_guest_proposal_created');
    if (hasCreated) {
      navigate('/auth?guest_limit=1', { replace: true });
      return;
    }
    // Check IP-based limit
    const checkIp = async () => {
      try {
        const { data } = await supabase.functions.invoke('log-visit', {
          body: { page_url: '/guest/new-proposal', check_guest_ip: true },
        });
        if (data?.ip_blocked) {
          navigate('/auth?guest_limit=1', { replace: true });
        }
      } catch {
        // If IP check fails, allow the guest to proceed
      }
    };
    checkIp();
  }, [navigate]);

  const [trade, setTrade] = useState<TradeType>('general_contractor');

  // Guest company info
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');

  // Client / Job
  const [clientName, setClientName] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  // Line items
  const [items, setItems] = useState<LineItem[]>(() => makeDefaults('general_contractor'));

  // Tax, Discount, Deposit
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(0);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [discountMode, setDiscountMode] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState(0);
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositMode, setDepositMode] = useState<'flat' | 'percentage'>('percentage');
  const [depositValue, setDepositValue] = useState(50);

  // AI suggestion review
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

  const handleTradeChange = (t: TradeType) => {
    setTrade(t);
    setItems(makeDefaults(t));
  };

  const validate = () => {
    if (!clientName.trim()) {
      toast({ title: 'Client name is required', variant: 'destructive' });
      return false;
    }
    if (!jobDescription.trim()) {
      toast({ title: 'Please describe the job', variant: 'destructive' });
      return false;
    }
    if (items.length === 0 || items.every(i => !i.description.trim())) {
      toast({ title: 'Add at least one line item', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleBuildClick = async () => {
    if (!validate()) return;
    logGuestProposalEvent('start');

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
        await generateProposal(items);
      }
    } catch {
      await generateProposal(items);
    } finally {
      setIsSuggesting(false);
    }
  };

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

      const guestCompany = {
        company_name: companyName || null,
        phone: companyPhone || null,
        email: companyEmail || null,
      };

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
          company: guestCompany,
        },
      });

      if (aiError) throw new Error(aiError.message || 'AI generation failed');
      if (aiData?.error) throw new Error(aiData.error);

      // Store the entire guest proposal in localStorage
      const guestProposal = {
        template: 'clean',
        trade_type: trade,
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
        subtotal: finalSubtotal,
        tax_rate: taxEnabled ? taxRate : 0,
        tax_amount: finalTax,
        total: finalGrandTotal,
        deposit_mode: depositEnabled ? depositMode : 'percentage',
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
        status: 'draft',
        // Guest company info
        guest_company: guestCompany,
      };

      const guestLineItems = finalItems.filter(i => i.description.trim()).map((item, i) => ({
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        subtotal: item.quantity * item.unit_price,
        sort_order: i,
      }));

      localStorage.setItem('ezbid_guest_proposal', JSON.stringify(guestProposal));
      localStorage.setItem('ezbid_guest_line_items', JSON.stringify(guestLineItems));
      localStorage.setItem('ezbid_guest_proposal_created', 'true');

      // Log IP for rate limiting
      supabase.functions.invoke('log-visit', {
        body: { page_url: '/guest/new-proposal', log_guest_proposal: true },
      }).catch(() => {});

      logGuestProposalEvent('complete');
      toast({ title: 'Proposal generated!' });
      navigate('/guest/preview');
    } catch (err: any) {
      console.error('Generate proposal error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const isWorking = isSuggesting || isGenerating;

  return (
    <div className="min-h-screen bg-background">
      {/* Simple header */}
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link to="/">
            <EZBidLogo size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link to="/auth?signup=1">
              <Button size="sm">Create account</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container max-w-4xl px-4 py-8 animate-fade-in space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create a Free Proposal</h1>
          <p className="text-muted-foreground mt-1">No account needed — build a professional proposal in minutes.</p>
        </div>

        {/* Guest Company Info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Your Company Details <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
          <p className="text-sm text-muted-foreground">Add your company details to make this proposal yours.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Company Name</label>
              <Input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Your Company Name"
                className="h-12"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Phone</label>
              <Input
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="h-12"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Email</label>
              <Input
                value={companyEmail}
                onChange={e => setCompanyEmail(e.target.value)}
                placeholder="you@company.com"
                className="h-12"
              />
            </div>
          </div>
        </div>

        {/* Trade */}
        <TradeSelector selected={trade} onSelect={handleTradeChange} />

        {/* Job Info */}
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

        {/* Line Items */}
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
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border bg-background">
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

        {/* Build Button */}
        {!showSuggestions && (
          <div className="pt-4 pb-8">
            <Button
              onClick={handleBuildClick}
              disabled={isWorking}
              className="w-full h-14 text-lg font-semibold"
              size="lg"
            >
              {isSuggesting ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Analyzing Your Quote…</>
              ) : isGenerating ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Building Your Proposal…</>
              ) : (
                <><Sparkles className="h-5 w-5 mr-2" /> Build Proposal with AI</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
