import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
import { Sparkles, Loader2, X, Check, Mic, MicOff } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

// Phone formatting
function formatPhoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// Speech recognition hook
function useSpeechRecognition() {
  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);

  const start = useCallback((onResult: (text: string) => void, onEnd?: () => void) => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    stop();
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let finalTranscript = '';
    recognition.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript + ' ';
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      onResult(finalTranscript + interim);
    };
    recognition.onend = () => { setIsRecording(false); onEnd?.(); };
    recognition.onerror = () => { setIsRecording(false); };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  return { isRecording, start, stop };
}

export default function NewProposal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { createProposal, isCreating } = useProposals();
  const { subscription, canCreateProposal, isLoading: subLoading, incrementProposalCount } = useSubscription();
  const { profile } = useCompanyProfile();

  // User intelligence context — fetched silently in background
  const userContextRef = useRef<any>(null);
  const [userContextReady, setUserContextReady] = useState(false);
  const [smartDefaultsApplied, setSmartDefaultsApplied] = useState(false);
  const [historyBadges, setHistoryBadges] = useState<Record<string, boolean>>({});

  // Trade
  const defaultTrade = (profile?.trade_type as TradeType) || 'general_contractor';
  const [trade, setTrade] = useState<TradeType>(defaultTrade);

  // Client Info
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientMatches, setClientMatches] = useState<any[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch client count on mount
  useEffect(() => {
    if (!user) return;
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => { if (count !== null) setClientCount(count); });
  }, [user]);

  // Search clients as user types
  useEffect(() => {
    if (!user || clientName.length < 1) { setClientMatches([]); return; }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('clients')
        .select('name, email, phone, address')
        .eq('user_id', user.id)
        .ilike('name', `%${clientName}%`)
        .limit(5);
      setClientMatches(data || []);
    }, 200);
    return () => clearTimeout(timer);
  }, [clientName, user]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowClientDropdown(false); };
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowClientDropdown(false);
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => { document.removeEventListener('keydown', handleKey); document.removeEventListener('mousedown', handleClick); };
  }, []);

  // Fire-and-forget: fetch user intelligence context on mount
  useEffect(() => {
    if (!user) return;
    supabase.functions.invoke('build-user-context', {
      body: { trade, job_description: '', job_address: '' },
    }).then(({ data }) => {
      if (data?.has_sufficient_history && data?.intelligence_profile) {
        userContextRef.current = data;
        setUserContextReady(true);
      }
    }).catch(() => {}); // Silent failure
  }, [user, trade]);

  // Job Description
  const [jobDescription, setJobDescription] = useState('');
  const descSpeech = useSpeechRecognition();
  const [descBaseText, setDescBaseText] = useState('');

  // Steps
  const [step, setStep] = useState<'input' | 'questions' | 'pricing' | 'build'>('input');

  // Clarifying questions
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [activeQMic, setActiveQMic] = useState<number | null>(null);
  const activeRecognition = useRef<any>(null);

  // Pricing toggle
  const [aiPricing, setAiPricing] = useState(true);

  // Materials
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

  // AI suggestion review
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Apply smart defaults from intelligence when available
  useEffect(() => {
    if (smartDefaultsApplied) return;
    const ctx = userContextRef.current;
    if (!ctx?.intelligence_profile?.smart_defaults) return;
    const sd = ctx.intelligence_profile.smart_defaults;
    const badges: Record<string, boolean> = {};

    if (sd.suggested_tax_rate && taxRate === 0) {
      setTaxRate(sd.suggested_tax_rate);
      setTaxEnabled(true);
      badges.taxRate = true;
    }
    if (sd.suggested_deposit_pct && depositValue === 50) {
      setDepositValue(sd.suggested_deposit_pct);
      setDepositEnabled(true);
      badges.depositValue = true;
    }
    if (sd.suggested_deposit_mode) {
      setDepositMode(sd.suggested_deposit_mode as 'percentage' | 'flat');
    }

    setHistoryBadges(badges);
    setSmartDefaultsApplied(true);

    // Pre-populate high-confidence signature line items
    const sigItems = ctx.intelligence_profile.signature_line_items || [];
    const highConf = sigItems.filter((si: any) => si.confidence === 'high');
    if (highConf.length > 0) {
      const newItems: LineItem[] = highConf.map((si: any, i: number) => ({
        id: `sig_${Date.now()}_${i}`,
        description: si.description,
        quantity: si.suggested_quantity || 1,
        unit: si.suggested_unit || 'ea',
        unit_price: si.suggested_unit_price || 0,
        fromHistory: true,
      }));
      setItems(prev => {
        const hasContent = prev.some(i => i.description.trim());
        return hasContent ? [...newItems, ...prev] : newItems;
      });
    }
  }, [userContextReady, smartDefaultsApplied]);

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
    return true;
  };

  // STEP 3: Continue → get clarifying questions
  const handleContinue = async () => {
    if (!validate()) return;
    trackEvent('proposal_started', { trade });
    setIsLoadingQuestions(true);
    try {
      const uc = userContextRef.current?.intelligence_profile || null;
      const { data, error } = await supabase.functions.invoke('generate-clarifying-questions', {
        body: {
          trade,
          job_description: jobDescription,
          company_profile: {
            company_name: profile?.company_name || '',
            trade_type: profile?.trade_type || trade,
            owner_name: profile?.owner_name || '',
          },
          user_context: uc,
        },
      });
      if (error) throw error;
      const qs = data?.questions || ["Any specific materials or brands required?", "What is your target start date?"];
      setQuestions(qs);
      setAnswers(new Array(qs.length).fill(''));
      setStep('questions');
    } catch (err: any) {
      console.error('Clarifying questions error:', err);
      setQuestions(["Any specific materials or brands required?", "What is your target start date?"]);
      setAnswers(['', '']);
      setStep('questions');
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  // Question mic — single activeRecognition ref
  const startQMic = (idx: number) => {
    // Stop any existing
    if (activeRecognition.current) {
      try { activeRecognition.current.stop(); } catch {}
      activeRecognition.current = null;
    }
    setActiveQMic(null);

    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (e: any) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setAnswers(prev => { const n = [...prev]; n[idx] = transcript; return n; });
    };
    recognition.onend = () => { activeRecognition.current = null; setActiveQMic(null); };
    recognition.onerror = () => { activeRecognition.current = null; setActiveQMic(null); };
    activeRecognition.current = recognition;
    recognition.start();
    setActiveQMic(idx);
  };

  const stopQMic = () => {
    if (activeRecognition.current) {
      try { activeRecognition.current.stop(); } catch {}
      activeRecognition.current = null;
    }
    setActiveQMic(null);
  };

  // After questions → pricing toggle
  const handleAfterQuestions = () => {
    stopQMic();
    setStep('pricing');
  };

  // After pricing → build
  const handleAfterPricing = async () => {
    if (aiPricing) {
      setIsSuggestingMaterials(true);
      try {
        const uc = userContextRef.current?.intelligence_profile || null;
        const { data, error } = await supabase.functions.invoke('suggest-materials-pricing', {
          body: {
            trade_type: trade,
            job_description: jobDescription,
            job_site_address: jobAddress || null,
            user_context: uc,
            pricing_benchmarks: uc?.pricing_benchmarks || null,
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
        if (aiItems.length > 0) setItems(aiItems);
        if (data.materials_included) setMaterialsIncluded(data.materials_included);
        if (data.materials_excluded) setMaterialsExcluded(data.materials_excluded);
      } catch (err: any) {
        toast({ title: 'AI pricing failed', description: err.message || 'Could not get suggestions', variant: 'destructive' });
      } finally {
        setIsSuggestingMaterials(false);
      }
    }
    setStep('build');
  };

  // Build the enriched job description with Q&A
  const getEnrichedDescription = () => {
    let desc = jobDescription;
    const qaLines: string[] = [];
    questions.forEach((q, i) => {
      if (answers[i]?.trim()) {
        qaLines.push(`${q.replace(/\?$/, '')}: ${answers[i].trim()}.`);
      }
    });
    if (qaLines.length > 0) desc += '\n\n' + qaLines.join(' ');
    return desc;
  };

  // Upsert client to Supabase
  const upsertClient = async () => {
    if (!user || !clientName.trim()) return;
    try {
      // Check for existing match
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', clientName.trim())
        .eq('email', clientEmail.trim() || '')
        .limit(1);

      if (existing && existing.length > 0) {
        // Update
        await supabase.from('clients').update({
          phone: clientPhone || null,
          address: jobAddress || null,
        }).eq('id', existing[0].id);
      } else {
        // Insert
        await supabase.from('clients').insert({
          user_id: user.id,
          name: clientName.trim(),
          email: clientEmail.trim() || null,
          phone: clientPhone || null,
          address: jobAddress || null,
        });
      }
    } catch {} // Non-blocking
  };

  // Build proposal
  const handleBuildClick = async () => {
    const finalItems = items.filter(i => i.description.trim());
    if (finalItems.length === 0) {
      toast({ title: 'Add at least one line item', variant: 'destructive' });
      return;
    }
    await generateProposal(finalItems);
  };

  const generateProposal = async (finalItems: LineItem[]) => {
    setIsGenerating(true);
    try {
      const enrichedDesc = getEnrichedDescription();
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

      const uc = userContextRef.current?.intelligence_profile || null;
      const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-proposal', {
        body: {
          trade,
          client_name: clientName,
          job_address: jobAddress,
          job_description: enrichedDesc,
          line_items: finalItems,
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
          user_context: uc,
          smart_defaults: uc?.smart_defaults || null,
          signature_line_items: uc?.signature_line_items || null,
        },
      });

      if (aiError) throw new Error(aiError.message || 'AI generation failed');
      if (aiData?.error) throw new Error(aiData.error);

      const proposal = await createProposal({
        template: 'clean' as any,
        trade_type: trade as any,
        client_name: clientName,
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
        job_site_street: jobAddress,
        job_site_city: null,
        job_site_state: null,
        job_site_zip: null,
        title: aiData.title || `${trade.replace(/_/g, ' ')} Proposal`,
        job_description: aiData.cover_letter || enrichedDesc,
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

      // Upsert client to Supabase (non-blocking)
      upsertClient();

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
        } catch {}
      }

      toast({ title: 'Proposal generated!' });
      trackEvent('proposal_generated', { trade });
      navigate(`/proposals/${proposal.id}/preview`);

      // Fire and forget — refresh intelligence cache in background
      supabase.functions.invoke('build-user-context', {
        body: {
          trade,
          job_description: jobDescription,
          job_address: jobAddress,
          force_refresh: true
        }
      }).catch(() => {});
    } catch (err: any) {
      console.error('Generate proposal error:', err);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const isWorking = isSuggesting || isGenerating || isSuggestingMaterials;

  return (
    <AppLayout>
      <div className="container max-w-4xl px-4 py-8 animate-fade-in space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">New Proposal</h1>
          <p className="text-muted-foreground mt-1">Select your trade, describe the job, and let AI build a professional proposal.</p>
        </div>

        {/* Trade */}
        <TradeSelector selected={trade} onSelect={setTrade} />

        {/* STEP 1: Client Info */}
        {step === 'input' && (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Client Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative" ref={dropdownRef}>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-foreground">Client Name</label>
                    {clientCount > 0 && (
                      <Badge variant="secondary" className="text-xs">{clientCount} saved</Badge>
                    )}
                  </div>
                  <Input
                    value={clientName}
                    onChange={e => { setClientName(e.target.value); setShowClientDropdown(true); }}
                    onFocus={() => setShowClientDropdown(true)}
                    placeholder="John Smith"
                    className="h-11"
                  />
                  {showClientDropdown && clientMatches.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-[200px] overflow-auto">
                      {clientMatches.map((c: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                          onMouseDown={e => {
                            e.preventDefault();
                            setClientName(c.name);
                            setClientEmail(c.email || '');
                            setClientPhone(c.phone ? formatPhoneDisplay(c.phone) : '');
                            setJobAddress(c.address || '');
                            setShowClientDropdown(false);
                          }}
                        >
                          <div className="font-medium">{c.name}</div>
                          {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Job Address</label>
                  <Input
                    value={jobAddress}
                    onChange={e => setJobAddress(e.target.value)}
                    placeholder="123 Main St, City, State"
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Client Email</label>
                  <Input
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    placeholder="client@email.com"
                    className="h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Client Phone</label>
                  <Input
                    type="tel"
                    value={clientPhone}
                    onChange={e => setClientPhone(formatPhoneDisplay(e.target.value))}
                    placeholder="(555) 123-4567"
                    className="h-11"
                  />
                </div>
              </div>
            </div>

            {/* STEP 2: Describe the Work */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Describe the Work</h2>
                {jobDescription.trim() && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => { setJobDescription(''); setDescBaseText(''); }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <Textarea
                value={jobDescription}
                onChange={e => { setJobDescription(e.target.value); setDescBaseText(e.target.value); }}
                placeholder="Walk us through the job — what needs to be done, materials, timeline, anything relevant..."
                rows={6}
                className="text-base"
              />
              <Button
                type="button"
                variant={descSpeech.isRecording ? 'destructive' : 'outline'}
                className="gap-2"
                onMouseDown={() => {
                  if (descSpeech.isRecording) {
                    descSpeech.stop();
                  } else {
                    const base = jobDescription;
                    setDescBaseText(base);
                    descSpeech.start((transcript) => {
                      setJobDescription(base + (base ? ' ' : '') + transcript);
                    });
                  }
                }}
                onTouchStart={() => {
                  if (!descSpeech.isRecording) {
                    const base = jobDescription;
                    setDescBaseText(base);
                    descSpeech.start((transcript) => {
                      setJobDescription(base + (base ? ' ' : '') + transcript);
                    });
                  }
                }}
                onMouseUp={() => { if (descSpeech.isRecording) descSpeech.stop(); }}
                onTouchEnd={() => { if (descSpeech.isRecording) descSpeech.stop(); }}
              >
                {descSpeech.isRecording ? (
                  <><Mic className="h-4 w-4 animate-pulse text-white" /> Recording… release to stop</>
                ) : (
                  <><Mic className="h-4 w-4" /> 🎤 Hold to Speak</>
                )}
              </Button>
            </div>

            {/* Continue Button */}
            <Button
              onClick={handleContinue}
              disabled={isLoadingQuestions}
              className="w-full h-12 text-base font-semibold"
            >
              {isLoadingQuestions ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Thinking about your project…</>
              ) : (
                <>Continue →</>
              )}
            </Button>
          </div>
        )}

        {/* STEP 3: Clarifying Questions */}
        {step === 'questions' && (
          <div className="space-y-6 animate-fade-in">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✨</span>
                  <h3 className="font-semibold text-foreground">A few quick questions</h3>
                </div>
                {questions.map((q, idx) => (
                  <div key={idx} className="space-y-1">
                    <Label className="text-sm">{q}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={answers[idx] || ''}
                        onChange={e => {
                          const n = [...answers]; n[idx] = e.target.value; setAnswers(n);
                        }}
                        placeholder="Type your answer..."
                        className="h-10 flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={`shrink-0 ${activeQMic === idx ? 'text-red-500' : ''}`}
                        onClick={() => {
                          if (activeQMic === idx) stopQMic();
                          else startQMic(idx);
                        }}
                      >
                        <Mic className={`h-4 w-4 ${activeQMic === idx ? 'animate-pulse' : ''}`} />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button onClick={handleAfterQuestions} className="w-full h-12 text-base font-semibold">
                  Continue →
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={handleAfterQuestions}
                  >
                    Skip →
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 4: Pricing Toggle */}
        {step === 'pricing' && (
          <div className="space-y-6 animate-fade-in">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">Want AI to estimate materials & pricing?</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      We'll generate line items with regionally-accurate pricing based on your job details.
                    </p>
                  </div>
                  <Switch checked={aiPricing} onCheckedChange={setAiPricing} />
                </div>
              </CardContent>
            </Card>

            {!aiPricing && (
              <div className="animate-fade-in">
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
              </div>
            )}

            <Button
              onClick={handleAfterPricing}
              disabled={isSuggestingMaterials}
              className="w-full h-12 text-base font-semibold"
            >
              {isSuggestingMaterials ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Getting AI pricing…</>
              ) : (
                <>Continue →</>
              )}
            </Button>
          </div>
        )}

        {/* STEP 5: Build */}
        {step === 'build' && (
          <div className="space-y-6 animate-fade-in">
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

            {/* Line items */}
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

            {/* Build button */}
            <div className="pt-4 pb-8">
              <Button
                onClick={handleBuildClick}
                disabled={isWorking || isCreating}
                className="w-full h-14 text-lg font-semibold"
                size="lg"
              >
                {isGenerating ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Building Your Proposal…</>
                ) : (
                  <><Sparkles className="h-5 w-5 mr-2" /> Build Proposal →</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
