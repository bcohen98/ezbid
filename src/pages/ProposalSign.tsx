import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatCurrency';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Loader2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import ProposalDocument from '@/components/proposal/ProposalDocument';
import type { TemplateId } from '@/components/proposal/TemplateSwitcher';

interface ProposalData {
  proposal: any;
  line_items: any[];
  company_profile: any;
  exhibits: any[];
}

export default function ProposalSign() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [data, setData] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (!id || !token) {
      setError('Invalid signing link');
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data: result, error: rpcErr } = await supabase.rpc('get_proposal_for_signing', {
          p_proposal_id: id,
          p_signing_token: token,
        });

        if (rpcErr || !result) {
          setError('Proposal not found or invalid link');
          setLoading(false);
          return;
        }

        const parsed = typeof result === 'string' ? JSON.parse(result) : result;



        if (parsed.proposal.status === 'signed' || parsed.proposal.client_signature_url) {
          setData(parsed);
          setSigned(true);
          setLoading(false);
          return;
        }

        setData(parsed);
      } catch {
        setError('Failed to load proposal');
      }
      setLoading(false);
    })();
  }, [id, token]);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#1a1a1a';

    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      if ('touches' in e) {
        return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
      }
      return { x: (e as MouseEvent).clientX - r.left, y: (e as MouseEvent).clientY - r.top };
    };

    const start = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      isDrawing.current = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing.current) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      setHasSignature(true);
    };

    const end = () => { isDrawing.current = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', end);

    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', end);
      canvas.removeEventListener('mouseleave', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', end);
    };
  }, [loading, signed]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSign = async () => {
    if (!canvasRef.current || !data?.proposal || !token) return;
    setSigning(true);
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      
      const { data: result, error: signErr } = await supabase.functions.invoke('sign-proposal', {
        body: {
          proposal_id: data.proposal.id,
          signing_token: token,
          signature_data: dataUrl,
        },
      });

      if (signErr) {
        throw new Error(signErr.context?.error || signErr.message || 'Failed to sign proposal');
      }
      if (result?.error) throw new Error(result.error);

      setSigned(true);
    } catch (err: any) {
      setError(err?.message || err?.context?.error || 'Failed to sign proposal');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Proposal Not Found</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  const proposal = data?.proposal;
  const lineItems = data?.line_items || [];
  const profile = data?.company_profile;
  const exhibits = data?.exhibits || [];

  // Determine the template from the saved proposal
  const templateId: TemplateId = (['modern', 'classic', 'bold', 'minimal'].includes(proposal?.template) ? proposal.template : 'modern') as TemplateId;

  const handleDownloadPdf = async () => {
    const el = document.getElementById('proposal-document-content');
    if (!el) return;
    const proposalNum = String(proposal?.proposal_number || 0).padStart(4, '0');
    await html2pdf().set({
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: `Proposal-PRO-${proposalNum}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true, windowWidth: 816 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    }).from(el).save();
  };

  if (signed) {
    const isFullyExecuted = !!proposal?.contractor_signature_url;
    const ps = proposal?.payment_status || 'unpaid';
    const paymentLinkUrl = proposal?.payment_link_url as string | undefined;
    const paymentPending = (ps === 'deposit_requested' || ps === 'payment_requested') && !!paymentLinkUrl;
    const fullyPaid = ps === 'paid';
    const depositPaid = ps === 'deposit_paid';

    return (
      <div className="min-h-screen bg-muted/30">
        {/* Success banner */}
        <div className="bg-background border-b">
          <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">
                  {isFullyExecuted ? 'Proposal Fully Executed' : 'Proposal Signed'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {isFullyExecuted
                    ? 'Both parties have signed. This proposal is now a binding agreement.'
                    : `Thank you for signing the proposal from ${profile?.company_name || 'your contractor'}.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Button onClick={handleDownloadPdf} variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download as PDF
              </Button>
              {paymentPending && (
                <Button asChild size="sm" className="gap-2">
                  <a href={paymentLinkUrl} target="_blank" rel="noopener noreferrer">
                    Pay Now — ${formatCurrency(Number(ps === 'deposit_requested' ? proposal?.deposit_amount : (proposal?.total - (proposal?.deposit_paid_amount || 0))))}
                  </a>
                </Button>
              )}
              {depositPaid && (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Deposit Paid
                </span>
              )}
              {fullyPaid && (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Payment Complete
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Full styled proposal */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div id="proposal-document-content" className="bg-white rounded-lg border shadow-sm overflow-hidden mt-3">
            <ProposalDocument
              proposal={proposal}
              lineItems={lineItems}
              profile={profile}
              exhibits={exhibits}
              template={templateId}
              clientView
            />
          </div>

          <div className="text-center text-xs text-muted-foreground py-8">
            Powered by <span className="font-medium">EZ-Bid</span>
          </div>
        </div>
      </div>
    );
  }

  if (!proposal) return null;

  const companyName = profile?.company_name || 'Contractor';

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Proposal from</div>
            <div className="font-semibold">{companyName}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">PRO-{String(proposal.proposal_number).padStart(4, '0')}</div>
            <div className="text-lg font-semibold">${formatCurrency(proposal.total)}</div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Styled proposal document */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <ProposalDocument
            proposal={proposal}
            lineItems={lineItems}
            profile={profile}
            exhibits={exhibits}
            template={templateId}
            clientView
          />
        </div>

        {/* Signature section */}
        <div className="bg-background rounded-lg border shadow-sm p-8">
          <h2 className="text-lg font-semibold mb-1">Sign This Proposal</h2>
          <p className="text-sm text-muted-foreground mb-6">
            By signing below, you agree to the scope of work, pricing, and terms outlined above.
          </p>

          <div className="border rounded-lg overflow-hidden mb-3 bg-white">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair touch-none"
              style={{ height: '160px' }}
            />
          </div>

          <div className="flex items-center justify-between mb-6">
            <p className="text-xs text-muted-foreground">Draw your signature above</p>
            <Button variant="ghost" size="sm" onClick={clearSignature} className="text-xs">
              Clear
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive mb-4">{error}</p>
          )}

          <Button
            type="button"
            className="w-full gap-2"
            size="lg"
            disabled={!hasSignature || signing}
            onClick={handleSign}
          >
            {signing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {signing ? 'Submitting...' : 'Accept & Sign Proposal'}
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pb-8">
          Powered by <span className="font-medium">EZ-Bid</span>
        </div>
      </div>
    </div>
  );
}

interface ViewToggleBarProps {
  showMaterials: boolean;
  setShowMaterials: (v: boolean) => void;
  showQuantities: boolean;
  setShowQuantities: (v: boolean) => void;
  showPricing: boolean;
  setShowPricing: (v: boolean) => void;
}

function ViewToggleBar({
  showMaterials, setShowMaterials,
  showQuantities, setShowQuantities,
  showPricing, setShowPricing,
}: ViewToggleBarProps) {
  const toggles = [
    { label: 'Materials', value: showMaterials, set: setShowMaterials },
    { label: 'Quantities', value: showQuantities, set: setShowQuantities },
    { label: 'Pricing', value: showPricing, set: setShowPricing },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2">
      <span className="text-xs text-muted-foreground px-2">View:</span>
      {toggles.map(t => (
        <button
          key={t.label}
          type="button"
          onClick={() => t.set(!t.value)}
          aria-pressed={t.value}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors border',
            t.value
              ? 'bg-foreground text-background border-foreground hover:bg-foreground/90'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          )}
        >
          {t.value ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          Show {t.label}
        </button>
      ))}
    </div>
  );
}
