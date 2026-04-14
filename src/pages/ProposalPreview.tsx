import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProposal, useProposalLineItems, useProposals } from '@/hooks/useProposals';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import AppLayout from '@/components/AppLayout';
import ProposalDocument from '@/components/proposal/ProposalDocument';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, Mail, Sparkles, Loader2, Download, FileText, Undo2 } from 'lucide-react';
import CountersignBanner from '@/components/proposal/CountersignBanner';
import ExhibitsUpload from '@/components/proposal/ExhibitsUpload';
import { useProposalExhibits } from '@/hooks/useProposalExhibits';
import TemplateSwitcher, { type TemplateId } from '@/components/proposal/TemplateSwitcher';
import ProposalCustomizer, { type FontStyle, type HeaderStyle } from '@/components/proposal/ProposalCustomizer';
import { getTradeStyle } from '@/components/proposal/tradeStyles';
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/trackEvent';

interface RevisionEntry {
  request: string;
  changes: Record<string, unknown>;
  timestamp: string;
}

export default function ProposalPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: proposal, isLoading, refetch } = useProposal(id);
  const { lineItems, upsertItems } = useProposalLineItems(id);
  const { profile } = useCompanyProfile();
  const { updateProposal } = useProposals();
  const { exhibits, isAdding, addExhibit, updateCaption, removeExhibit } = useProposalExhibits(id);
  const [revisionNote, setRevisionNote] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSendingSelf, setIsSendingSelf] = useState(false);
  const [isSendingClient, setIsSendingClient] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [isSuggestingMaterials, setIsSuggestingMaterials] = useState(false);
  const lastSnapshot = useRef<{ proposal: any; lineItems: any[] } | null>(null);

  // Template switching
  const getDefaultTemplate = (): TemplateId => {
    const saved = localStorage.getItem('ezbid_default_template');
    if (saved && ['edge', 'heritage', 'command', 'linen'].includes(saved)) return saved as TemplateId;
    const dbTemplate = (proposal?.template as string) || 'edge';
    // Map legacy names
    const legacyMap: Record<string, TemplateId> = { modern: 'edge', classic: 'heritage', bold: 'command', minimal: 'linen' };
    return (legacyMap[dbTemplate] || dbTemplate) as TemplateId;
  };
  const [activeTemplate, setActiveTemplate] = useState<TemplateId>(getDefaultTemplate);
  const [accentColor, setAccentColor] = useState<string>('');
  const [fontStyle, setFontStyle] = useState<FontStyle>('modern');
  const [headerStyle, setHeaderStyle] = useState<HeaderStyle>('dark');

  const handleTemplateChange = async (t: TemplateId) => {
    setActiveTemplate(t);
    localStorage.setItem('ezbid_default_template', t);
    if (proposal) {
      await updateProposal({ id: proposal.id, template: t as any });
    }
  };

  const tradeStyle = proposal ? getTradeStyle((proposal as any).trade_type || profile?.trade_type) : null;

  // Initialize customization from saved proposal data
  useEffect(() => {
    if (proposal) {
      if ((proposal as any).custom_accent_color) setAccentColor((proposal as any).custom_accent_color);
      if ((proposal as any).font_style) setFontStyle((proposal as any).font_style as FontStyle);
      if ((proposal as any).header_style) setHeaderStyle((proposal as any).header_style as HeaderStyle);
    }
  }, [proposal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccentChange = async (color: string) => {
    setAccentColor(color);
    if (proposal) await updateProposal({ id: proposal.id, custom_accent_color: color } as any);
  };
  const handleFontChange = async (font: FontStyle) => {
    setFontStyle(font);
    if (proposal) await updateProposal({ id: proposal.id, font_style: font } as any);
  };
  const handleHeaderStyleChange = async (hs: HeaderStyle) => {
    setHeaderStyle(hs);
    if (proposal) await updateProposal({ id: proposal.id, header_style: hs } as any);
  };

  if (isLoading) {
    return <AppLayout><div className="container py-8"><p className="text-sm text-muted-foreground">Loading preview...</p></div></AppLayout>;
  }

  if (!proposal) {
    return <AppLayout><div className="container py-8"><p className="text-sm text-muted-foreground">Proposal not found</p></div></AppLayout>;
  }

  const isSigned = ['signed', 'accepted', 'work_pending', 'payment_pending', 'closed'].includes(proposal.status) || !!proposal.client_signature_url;

  console.log('[ProposalPreview] render — client_email:', JSON.stringify(proposal.client_email), 'type:', typeof proposal.client_email, 'falsy:', !proposal.client_email);

  const revisionHistory: RevisionEntry[] = Array.isArray((proposal as any).revision_history) ? (proposal as any).revision_history : [];

  const saveSnapshot = () => {
    lastSnapshot.current = { proposal: { ...proposal }, lineItems: [...lineItems] };
  };

  const handleUndo = async () => {
    if (!lastSnapshot.current) {
      toast({ title: 'Nothing to undo' });
      return;
    }
    setIsUndoing(true);
    try {
      const snap = lastSnapshot.current;
      const { id, created_at, updated_at, user_id, ...fields } = snap.proposal;
      await updateProposal({ id: proposal.id, ...fields });
      await upsertItems(snap.lineItems.map((li: any, i: number) => ({
        proposal_id: proposal.id,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit || 'ea',
        unit_price: li.unit_price,
        subtotal: li.subtotal,
        sort_order: i,
      })));
      lastSnapshot.current = null;
      refetch();
      toast({ title: 'Undone!', description: 'Reverted to previous state.' });
    } catch (err: any) {
      toast({ title: 'Undo failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUndoing(false);
    }
  };

  const handleFieldEdit = async (field: string, value: string) => {
    try {
      saveSnapshot();
      await updateProposal({ id: proposal.id, [field]: value });
      refetch();
      toast({ title: 'Section updated' });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleLineItemEdit = async (itemId: string, updates: { description: string; quantity: number; unit: string; unit_price: number; subtotal: number }) => {
    try {
      saveSnapshot();
      const updatedItems = lineItems.map(li =>
        li.id === itemId
          ? { ...li, ...updates }
          : li
      );
      // Recalculate proposal totals
      const newSubtotal = updatedItems.reduce((sum, li) => sum + (li.subtotal || li.quantity * li.unit_price), 0);
      const taxRate = Number(proposal.tax_rate) || 0;
      const newTaxAmount = newSubtotal * taxRate / 100;
      const newTotal = newSubtotal + newTaxAmount;
      const depositValue = Number(proposal.deposit_value) || 0;
      const depositMode = proposal.deposit_mode || 'percentage';
      const newDepositAmount = depositMode === 'percentage' ? newTotal * depositValue / 100 : depositValue;
      const newBalanceDue = newTotal - newDepositAmount;

      // Save line items
      await upsertItems(updatedItems.map((li, i) => ({
        proposal_id: proposal.id,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit || 'ea',
        unit_price: li.unit_price,
        subtotal: li.subtotal,
        sort_order: i,
      })));

      // Update proposal totals
      await updateProposal({
        id: proposal.id,
        subtotal: newSubtotal,
        tax_amount: newTaxAmount,
        total: newTotal,
        deposit_amount: newDepositAmount,
        balance_due: newBalanceDue,
      });

      refetch();
      toast({ title: 'Pricing updated' });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteLineItem = async (itemId: string) => {
    try {
      saveSnapshot();
      const remaining = lineItems.filter(li => li.id !== itemId);
      const newSubtotal = remaining.reduce((sum, li) => sum + (li.subtotal || li.quantity * li.unit_price), 0);
      const taxRate = Number(proposal.tax_rate) || 0;
      const newTaxAmount = newSubtotal * taxRate / 100;
      const newTotal = newSubtotal + newTaxAmount;
      const depositValue = Number(proposal.deposit_value) || 0;
      const depositMode = proposal.deposit_mode || 'percentage';
      const newDepositAmount = depositMode === 'percentage' ? newTotal * depositValue / 100 : depositValue;
      const newBalanceDue = newTotal - newDepositAmount;

      await supabase.from('proposal_line_items').delete().eq('id', itemId);
      await updateProposal({
        id: proposal.id,
        subtotal: newSubtotal,
        tax_amount: newTaxAmount,
        total: newTotal,
        deposit_amount: newDepositAmount,
        balance_due: newBalanceDue,
      });
      refetch();
      toast({ title: 'Line item deleted' });
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleAddLineItem = async () => {
    try {
      saveSnapshot();
      const newSortOrder = lineItems.length;
      const newItem = {
        proposal_id: proposal.id,
        description: '',
        quantity: 1,
        unit: 'ea',
        unit_price: 0,
        subtotal: 0,
        sort_order: newSortOrder,
      };
      await upsertItems([...lineItems.map((li, i) => ({
        proposal_id: proposal.id,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit || 'ea',
        unit_price: li.unit_price,
        subtotal: li.subtotal,
        sort_order: i,
      })), newItem]);
      refetch();
      toast({ title: 'Line item added' });
    } catch (err: any) {
      toast({ title: 'Failed to add item', description: err.message, variant: 'destructive' });
    }
  };

  const handleTotalsEdit = async (updates: { tax_rate: number; deposit_mode: string; deposit_value: number }) => {
    try {
      saveSnapshot();
      const sub = Number(proposal.subtotal) || 0;
      const taxAmount = sub * updates.tax_rate / 100;
      const total = sub + taxAmount;
      const depositAmount = updates.deposit_mode === 'percentage' ? total * updates.deposit_value / 100 : updates.deposit_value;
      const balanceDue = total - depositAmount;

      await updateProposal({
        id: proposal.id,
        tax_rate: updates.tax_rate,
        tax_amount: taxAmount,
        total,
        deposit_mode: updates.deposit_mode as any,
        deposit_value: updates.deposit_value,
        deposit_amount: depositAmount,
        balance_due: balanceDue,
      });
      refetch();
      toast({ title: 'Totals updated' });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleRevise = async () => {
    if (!revisionNote.trim() || !proposal) return;
    setIsRevising(true);
    try {
      saveSnapshot();
      if (proposal.status === 'sent') {
        const nextVersion = revisionHistory.length + 1;
        await supabase.from('proposal_versions').insert({
          proposal_id: proposal.id,
          version_number: nextVersion,
          snapshot: proposal as any,
          change_summary: revisionNote.trim(),
        });
      }

      const { data, error } = await supabase.functions.invoke('revise-proposal', {
        body: {
          proposal,
          revisionNote: revisionNote.trim(),
          lineItems,
          revisionHistory: revisionHistory.slice(-5), // Last 5 for context
        },
      });
      if (error) throw error;
      if (data?.revised) {
        const { line_items: revisedLineItems, ...proposalUpdates } = data.revised;

        // Update line items if AI changed them
        if (revisedLineItems && Array.isArray(revisedLineItems)) {
          const newItems = revisedLineItems.map((li: any, i: number) => ({
            proposal_id: proposal.id,
            description: li.description,
            quantity: li.quantity,
            unit: li.unit || 'ea',
            unit_price: li.unit_price,
            subtotal: li.subtotal || li.quantity * li.unit_price,
            sort_order: i,
          }));
          await upsertItems(newItems);
        }

        // Store revision in history
        const newEntry: RevisionEntry = {
          request: revisionNote.trim(),
          changes: proposalUpdates,
          timestamp: new Date().toISOString(),
        };
        const updatedHistory = [...revisionHistory, newEntry];

        await updateProposal({
          id: proposal.id,
          ...proposalUpdates,
          revision_history: updatedHistory as any,
        });
        setRevisionNote('');
        refetch();
        toast({ title: 'Proposal revised!', description: 'Review the changes below.' });
      }
    } catch (err: any) {
      toast({ title: 'Revision failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsRevising(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: {
          proposal_id: proposal.id,
          template: activeTemplate,
          accent_color: accentColor || undefined,
          font_style: fontStyle,
          header_style: headerStyle,
        },
      });
      if (error) throw error;
      if (data?.html) {
        // Use a hidden iframe so <html>/<head>/<style> tags are preserved
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.top = '0';
        iframe.style.width = '816px';
        iframe.style.height = '1056px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) throw new Error('Could not access iframe document');
        iframeDoc.open();
        iframeDoc.write(data.html);
        iframeDoc.close();

        // Wait for fonts and layout to settle
        await new Promise(resolve => setTimeout(resolve, 800));

        const html2pdf = (await import('html2pdf.js')).default;
        const fileName = data.fileName || `Proposal-PRO-${String(proposal.proposal_number).padStart(4, '0')}.pdf`;

        await html2pdf()
          .set({
            margin: [0.4, 0.4, 0.6, 0.4],
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, letterRendering: true, windowWidth: 816 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
          })
          .from(iframeDoc.body)
          .save();

        document.body.removeChild(iframe);
        toast({ title: 'PDF downloaded', description: fileName });
      }
    } catch (err: any) {
      toast({ title: 'PDF generation failed', description: err.message, variant: 'destructive' });
    } finally {
      trackEvent('proposal_downloaded', { proposal_id: proposal.id });
      setIsGeneratingPdf(false);
    }
  };

  const handleSendSelf = async () => {
    console.log('[handleSendSelf] triggered, proposal_id:', proposal.id);
    setIsSendingSelf(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-proposal-email', {
        body: { proposal_id: proposal.id, send_to_self: true },
      });
      if (error) throw error;
      toast({ title: 'Email sent!', description: 'Check your inbox — if you don\'t see it, check your spam or junk folder.' });
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingSelf(false);
    }
  };

  const handleSendClient = async () => {
    console.log('[handleSendClient] triggered, proposal_id:', proposal.id, 'client_email:', proposal.client_email);
    if (!proposal.client_email) {
      console.log('[handleSendClient] BLOCKED: no client_email');
      toast({ title: 'Missing client email', description: 'Please add a client email address in the proposal form.', variant: 'destructive' });
      return;
    }
    setIsSendingClient(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-proposal-email', {
        body: {
          proposal_id: proposal.id,
          recipient_email: proposal.client_email,
          recipient_name: proposal.client_name,
          send_to_self: false,
        },
      });
      if (error) throw error;
      refetch();
      trackEvent('proposal_sent', { proposal_id: proposal.id, method: 'email_client' });
      toast({ title: 'Proposal sent!', description: `Sent to ${proposal.client_email}. Let them know to check spam or junk if they don't see it.` });
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingClient(false);
    }
  };

  return (
    <AppLayout>
      <div className="container px-4 py-5 md:py-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <Link to={`/proposals/${id}`}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back to edit form</Button>
          </Link>
          <h1 className="text-lg md:text-xl font-semibold">Proposal Preview</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Preview */}
          <div className="border rounded-lg overflow-x-auto bg-background shadow-sm">
            <ProposalDocument proposal={proposal} lineItems={lineItems} profile={profile} exhibits={exhibits} template={activeTemplate} customAccentColor={accentColor || undefined} fontStyle={fontStyle} customHeaderStyle={headerStyle} onFieldEdit={isSigned ? undefined : handleFieldEdit} onLineItemEdit={isSigned ? undefined : handleLineItemEdit} onAddLineItem={isSigned ? undefined : handleAddLineItem} onTotalsEdit={isSigned ? undefined : handleTotalsEdit} />
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {/* AI Revision — top of sidebar, hidden when signed */}
            {!isSigned && (
              <div className="border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> AI Revision
                </h3>

                <Textarea
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRevise(); } }}
                  placeholder="e.g. Switch to bold template, add a $500 line item for cleanup, change tax to 8.5%..."
                  rows={4}
                />
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  disabled={!revisionNote.trim() || isRevising}
                  onClick={handleRevise}
                >
                  {isRevising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isRevising ? 'Revising...' : 'Submit revision'}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    disabled={!lastSnapshot.current || isUndoing}
                    onClick={handleUndo}
                  >
                    {isUndoing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
                    Undo last edit
                  </Button>
                </div>
              </div>
            )}

            {/* Suggest Materials & Pricing */}
            {!isSigned && (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={isSuggestingMaterials}
                onClick={async () => {
                  setIsSuggestingMaterials(true);
                  try {
                    saveSnapshot();
                    const { data, error } = await supabase.functions.invoke('suggest-materials-pricing', {
                      body: {
                        trade_type: (proposal as any).trade_type || profile?.trade_type || 'general_contractor',
                        job_description: proposal.job_description || proposal.scope_of_work || '',
                        job_site_address: [proposal.job_site_street, proposal.job_site_city, proposal.job_site_state].filter(Boolean).join(', ') || null,
                      },
                    });
                    if (error) throw error;
                    if (data?.error) throw new Error(data.error);

                    // Apply line items
                    const aiItems = (data.line_items || []).map((li: any, i: number) => ({
                      proposal_id: proposal.id,
                      description: li.description,
                      quantity: li.quantity,
                      unit: li.unit || 'ea',
                      unit_price: li.unit_price,
                      subtotal: li.quantity * li.unit_price,
                      sort_order: lineItems.length + i,
                    }));

                    const hasExisting = lineItems.some(li => li.description?.trim() && li.unit_price > 0);
                    if (hasExisting && aiItems.length > 0) {
                      if (!window.confirm('This will add suggested line items to your existing table. Continue?')) {
                        aiItems.length = 0;
                      }
                    }

                    if (aiItems.length > 0) {
                      const allItems = [...lineItems.map((li, i) => ({
                        proposal_id: proposal.id,
                        description: li.description,
                        quantity: li.quantity,
                        unit: li.unit || 'ea',
                        unit_price: li.unit_price,
                        subtotal: li.subtotal,
                        sort_order: i,
                      })), ...aiItems];
                      await upsertItems(allItems);
                    }

                    // Apply materials
                    const updates: any = {};
                    if (data.materials_included) {
                      if (!proposal.materials_included?.trim() || window.confirm('This will replace your current materials list. Continue?')) {
                        updates.materials_included = data.materials_included;
                      }
                    }
                    if (data.materials_excluded) {
                      if (!proposal.materials_excluded?.trim() || window.confirm('This will replace your current materials excluded list. Continue?')) {
                        updates.materials_excluded = data.materials_excluded;
                      }
                    }

                    if (Object.keys(updates).length > 0) {
                      await updateProposal({ id: proposal.id, ...updates });
                    }

                    refetch();
                    toast({ title: 'Suggestions applied!', description: 'Review and adjust as needed.' });
                  } catch (err: any) {
                    toast({ title: 'Suggestion failed', description: err.message, variant: 'destructive' });
                  } finally {
                    setIsSuggestingMaterials(false);
                  }
                }}
              >
                {isSuggestingMaterials ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isSuggestingMaterials ? 'Suggesting…' : 'Suggest Materials & Pricing'}
              </Button>
            )}

            {/* Template Switcher */}
            <TemplateSwitcher
              current={activeTemplate}
              accentColor={accentColor || tradeStyle?.accentColor || '#374151'}
              onSelect={handleTemplateChange}
            />

            {/* Style Customizer */}
            <ProposalCustomizer
              accentColor={accentColor || tradeStyle?.accentColor || '#374151'}
              fontStyle={fontStyle}
              headerStyle={headerStyle}
              onAccentChange={handleAccentChange}
              onFontChange={handleFontChange}
              onHeaderChange={handleHeaderStyleChange}
            />

            {/* Countersign prompt */}
            {proposal.status === 'signed' && proposal.client_signature_url && !(proposal as any).contractor_signature_url && (
              <CountersignBanner
                proposalId={proposal.id}
                clientName={proposal.client_name}
                onSigned={() => refetch()}
              />
            )}

            {isSigned && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                This proposal has been signed and cannot be edited.
              </div>
            )}

            {/* Exhibits — read-only when signed */}
            {!isSigned && (
              <ExhibitsUpload
                exhibits={exhibits}
                isAdding={isAdding}
                onAdd={addExhibit}
                onUpdateCaption={updateCaption}
                onRemove={removeExhibit}
              />
            )}

            {/* Download & Send */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> Download & Send
              </h3>
              
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
              >
                {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isGeneratingPdf ? 'Generating...' : 'Download as PDF'}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleSendSelf}
                disabled={isSendingSelf}
              >
                {isSendingSelf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {isSendingSelf ? 'Sending...' : 'Send to my email'}
              </Button>

              <Button
                type="button"
                className="w-full gap-2"
                onClick={handleSendClient}
                disabled={isSendingClient}
              >
                {isSendingClient ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSendingClient ? 'Sending...' : 'Send to client'}
              </Button>

              {!proposal.client_email && (
                <p className="text-xs text-muted-foreground">Add a client email in the proposal form to enable sending.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
