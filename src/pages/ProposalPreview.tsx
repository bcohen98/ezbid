import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProposal, useProposalLineItems, useProposals } from '@/hooks/useProposals';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import AppLayout from '@/components/AppLayout';
import ProposalDocument from '@/components/proposal/ProposalDocument';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, Mail, Sparkles, Loader2, Download, FileText, Undo2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  const [revisionNote, setRevisionNote] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSendingSelf, setIsSendingSelf] = useState(false);
  const [isSendingClient, setIsSendingClient] = useState(false);

  if (isLoading) {
    return <AppLayout><div className="container py-8"><p className="text-sm text-muted-foreground">Loading preview...</p></div></AppLayout>;
  }

  if (!proposal) {
    return <AppLayout><div className="container py-8"><p className="text-sm text-muted-foreground">Proposal not found</p></div></AppLayout>;
  }

  const revisionHistory: RevisionEntry[] = Array.isArray((proposal as any).revision_history) ? (proposal as any).revision_history : [];

  const handleFieldEdit = async (field: string, value: string) => {
    try {
      await updateProposal({ id: proposal.id, [field]: value });
      refetch();
      toast({ title: 'Section updated' });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleLineItemEdit = async (itemId: string, updates: { description: string; quantity: number; unit: string; unit_price: number; subtotal: number }) => {
    try {
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

  const handleTotalsEdit = async (updates: { tax_rate: number; deposit_mode: string; deposit_value: number }) => {
    try {
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
      // If proposal is sent, save a version snapshot first
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
        body: { proposal_id: proposal.id },
      });
      if (error) throw error;
      if (data?.html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 500);
        }
        toast({ title: 'PDF ready', description: 'Use the print dialog to save as PDF.' });
      }
    } catch (err: any) {
      toast({ title: 'PDF generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSendSelf = async () => {
    setIsSendingSelf(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-proposal-email', {
        body: { proposal_id: proposal.id, send_to_self: true },
      });
      if (error) throw error;
      toast({ title: 'Email sent!', description: data?.message || 'Check your inbox.' });
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingSelf(false);
    }
  };

  const handleSendClient = async () => {
    if (!proposal.client_email) {
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
      toast({ title: 'Proposal sent!', description: data?.message || `Sent to ${proposal.client_email}` });
    } catch (err: any) {
      toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingClient(false);
    }
  };

  return (
    <AppLayout>
      <div className="container py-6 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link to={`/proposals/${id}`}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back to edit form</Button>
          </Link>
          <h1 className="text-xl font-semibold">Proposal Preview</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Preview */}
          <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
            <ProposalDocument proposal={proposal} lineItems={lineItems} profile={profile} onFieldEdit={handleFieldEdit} onLineItemEdit={handleLineItemEdit} onTotalsEdit={handleTotalsEdit} />
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {/* AI Revision */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> AI Revision
              </h3>


              <Textarea
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRevise(); } }}
                placeholder="e.g. Switch to bold template, add a $500 line item for cleanup, change tax to 8.5%... (Enter to submit, Shift+Enter for new line)"
                rows={4}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                disabled={!revisionNote.trim() || isRevising}
                onClick={handleRevise}
              >
                {isRevising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isRevising ? 'Revising...' : 'Submit revision'}
              </Button>
              <p className="text-xs text-muted-foreground">Supports text, template style, pricing, and line item changes. Click any section to edit directly.</p>
            </div>

            {/* Download & Send */}
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> Download & Send
              </h3>
              
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
              >
                {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isGeneratingPdf ? 'Generating...' : 'Download as PDF'}
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleSendSelf}
                disabled={isSendingSelf}
              >
                {isSendingSelf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {isSendingSelf ? 'Sending...' : 'Send to my email'}
              </Button>

              <Button
                className="w-full gap-2"
                onClick={handleSendClient}
                disabled={isSendingClient || !proposal.client_email}
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
