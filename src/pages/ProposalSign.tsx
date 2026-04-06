import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/formatCurrency';
import { formatPhone } from '@/lib/formatPhone';
import { Button } from '@/components/ui/button';
import { CheckCircle, Download, Loader2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';

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

  const handleDownloadPdf = async () => {
    const el = document.getElementById('signed-proposal-content');
    if (!el) return;
    const proposalNum = String(proposal?.proposal_number || 0).padStart(4, '0');
    await html2pdf().set({
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: `Proposal-PRO-${proposalNum}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
    }).from(el).save();
  };

  if (signed) {
    const isFullyExecuted = !!proposal?.contractor_signature_url;

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
            <Button onClick={handleDownloadPdf} variant="outline" size="sm" className="gap-2 mt-2">
              <Download className="h-4 w-4" />
              Download as PDF
            </Button>
          </div>
        </div>

        {/* Full proposal content */}
        <div id="signed-proposal-content" className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          <div className="bg-background rounded-lg border shadow-sm p-8 space-y-6">
            {/* Header with company info */}
            {profile?.logo_url && (
              <img src={profile.logo_url} alt={profile.company_name || ''} className="max-h-12 max-w-[180px]" />
            )}
            {proposal.title && <h1 className="text-xl font-semibold">{proposal.title}</h1>}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Prepared for</div>
                <div className="font-medium">{proposal.client_name}</div>
                {proposal.client_email && <div className="text-muted-foreground">{proposal.client_email}</div>}
                {proposal.client_phone && <div className="text-muted-foreground">{formatPhone(proposal.client_phone)}</div>}
              </div>
              <div className="text-right">
                <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">From</div>
                <div className="font-medium">{profile?.company_name}</div>
                {profile?.email && <div className="text-muted-foreground">{profile.email}</div>}
                {profile?.phone && <div className="text-muted-foreground">{formatPhone(profile.phone)}</div>}
                <div className="text-muted-foreground text-xs mt-2">PRO-{String(proposal.proposal_number).padStart(4, '0')}</div>
                <div className="text-muted-foreground text-xs">Date: {proposal.proposal_date}</div>
              </div>
            </div>

            {proposal.job_site_street && (
              <div className="text-sm">
                <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Job Site</div>
                <div>{[proposal.job_site_street, proposal.job_site_city, proposal.job_site_state, proposal.job_site_zip].filter(Boolean).join(', ')}</div>
              </div>
            )}

            {(proposal.enhanced_job_description || proposal.job_description) && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Job Description</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{proposal.enhanced_job_description || proposal.job_description}</p>
              </div>
            )}

            {(proposal.enhanced_scope_of_work || proposal.scope_of_work) && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Scope of Work</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{proposal.enhanced_scope_of_work || proposal.scope_of_work}</p>
              </div>
            )}

            {proposal.materials_included && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Materials Included</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{proposal.materials_included}</p>
              </div>
            )}

            {lineItems.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Pricing</h3>
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[400px]">
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
                    {lineItems.map((item: any) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">{item.description}</td>
                        <td className="text-right py-2">{item.quantity}</td>
                        <td className="text-right py-2">{item.unit}</td>
                        <td className="text-right py-2">${formatCurrency(item.unit_price)}</td>
                        <td className="text-right py-2">${formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
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

            {proposal.warranty_terms && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Warranty</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{proposal.warranty_terms}</p>
              </div>
            )}

            {proposal.payment_terms && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Payment Terms</h3>
                <p className="text-sm text-muted-foreground">{proposal.payment_terms}</p>
              </div>
            )}

            {proposal.disclosures && (
              <div>
                <h3 className="text-sm font-semibold mb-1">Disclosures</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{proposal.disclosures}</p>
              </div>
            )}

            {/* Signatures section */}
            <div className="border-t pt-6 mt-6">
              <h3 className="text-sm font-semibold mb-4">Signatures</h3>
              <div className="grid grid-cols-2 gap-8">
                {proposal.client_signature_url && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Client Signature</div>
                    <img src={proposal.client_signature_url} alt="Client signature" className="max-h-16 border-b pb-1" />
                    <div className="text-xs text-muted-foreground mt-1">
                      {proposal.client_name} — {proposal.client_signed_at ? new Date(proposal.client_signed_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                )}
                {proposal.contractor_signature_url && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Contractor Signature</div>
                    <img src={proposal.contractor_signature_url} alt="Contractor signature" className="max-h-16 border-b pb-1" />
                    <div className="text-xs text-muted-foreground mt-1">
                      {profile?.owner_name || profile?.company_name} — {proposal.contractor_signed_at ? new Date(proposal.contractor_signed_at).toLocaleDateString() : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Exhibits */}
          {exhibits.length > 0 && (
            <div className="bg-background rounded-lg border shadow-sm p-8 space-y-4">
              <h3 className="text-sm font-semibold">Exhibits & Attachments</h3>
              <div className="grid grid-cols-2 gap-4">
                {exhibits.map((exhibit: any, i: number) => (
                  <div key={exhibit.id} className="space-y-1">
                    <img src={exhibit.file_url} alt={exhibit.caption || `Exhibit ${i + 1}`} className="w-full rounded border object-contain max-h-64" />
                    <p className="text-xs text-muted-foreground text-center italic">{exhibit.caption || `Exhibit ${i + 1}`}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-center text-xs text-muted-foreground pb-8">
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

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Proposal details card */}
        <div className="bg-background rounded-lg border shadow-sm p-8 space-y-6">
          {proposal.title && <h1 className="text-xl font-semibold">{proposal.title}</h1>}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Prepared for</div>
              <div className="font-medium">{proposal.client_name}</div>
              {proposal.client_email && <div className="text-muted-foreground">{proposal.client_email}</div>}
              {proposal.client_phone && <div className="text-muted-foreground">{formatPhone(proposal.client_phone)}</div>}
            </div>
            <div className="text-right">
              <div className="text-muted-foreground text-xs">Date: {proposal.proposal_date}</div>
              <div className="text-muted-foreground text-xs">Valid until: {proposal.valid_until}</div>
            </div>
          </div>

          {proposal.job_site_street && (
            <div className="text-sm">
              <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Job Site</div>
              <div>{[proposal.job_site_street, proposal.job_site_city, proposal.job_site_state, proposal.job_site_zip].filter(Boolean).join(', ')}</div>
            </div>
          )}

          {(proposal.enhanced_job_description || proposal.job_description) && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Job Description</h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{proposal.enhanced_job_description || proposal.job_description}</p>
            </div>
          )}

          {(proposal.enhanced_scope_of_work || proposal.scope_of_work) && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Scope of Work</h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{proposal.enhanced_scope_of_work || proposal.scope_of_work}</p>
            </div>
          )}

          {proposal.materials_included && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Materials Included</h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{proposal.materials_included}</p>
            </div>
          )}

          {lineItems.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Pricing</h3>
              <table className="w-full text-sm">
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
                  {lineItems.map((item: any) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-2">{item.description}</td>
                      <td className="text-right py-2">{item.quantity}</td>
                      <td className="text-right py-2">{item.unit}</td>
                      <td className="text-right py-2">${formatCurrency(item.unit_price)}</td>
                      <td className="text-right py-2">${formatCurrency(item.subtotal)}</td>
                    </tr>
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

          {proposal.warranty_terms && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Warranty</h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{proposal.warranty_terms}</p>
            </div>
          )}

          {proposal.payment_terms && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Payment Terms</h3>
              <p className="text-sm text-muted-foreground">{proposal.payment_terms}</p>
              {proposal.accepted_payment_methods?.length ? (
                <p className="text-xs text-muted-foreground mt-1">Accepted: {proposal.accepted_payment_methods.join(', ')}</p>
              ) : null}
            </div>
          )}

          {proposal.disclosures && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Disclosures</h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{proposal.disclosures}</p>
            </div>
          )}
        </div>

        {/* Exhibits */}
        {exhibits.length > 0 && (
          <div className="bg-background rounded-lg border shadow-sm p-8 space-y-4">
            <h3 className="text-sm font-semibold">Exhibits & Attachments</h3>
            <div className="grid grid-cols-2 gap-4">
              {exhibits.map((exhibit: any, i: number) => (
                <div key={exhibit.id} className="space-y-1">
                  <img
                    src={exhibit.file_url}
                    alt={exhibit.caption || `Exhibit ${i + 1}`}
                    className="w-full rounded border object-contain max-h-64"
                  />
                  <p className="text-xs text-muted-foreground text-center italic">
                    {exhibit.caption || `Exhibit ${i + 1}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

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
