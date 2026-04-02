import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProposal, useProposalLineItems, useProposals } from '@/hooks/useProposals';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import AppLayout from '@/components/AppLayout';
import ProposalDocument from '@/components/proposal/ProposalDocument';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, Mail, Sparkles, Loader2, Download, FileText } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function ProposalPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: proposal, isLoading, refetch } = useProposal(id);
  const { lineItems } = useProposalLineItems(id);
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

  const handleRevise = async () => {
    if (!revisionNote.trim() || !proposal) return;
    setIsRevising(true);
    try {
      const { data, error } = await supabase.functions.invoke('revise-proposal', {
        body: { proposal, revisionNote: revisionNote.trim() },
      });
      if (error) throw error;
      if (data?.revised) {
        await updateProposal({ id: proposal.id, ...data.revised });
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
        // Open HTML in new window for printing as PDF
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          // Auto-trigger print dialog after a short delay for rendering
          setTimeout(() => {
            printWindow.print();
          }, 500);
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
      refetch(); // Status will be updated to "sent"
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
            <ProposalDocument proposal={proposal} lineItems={lineItems} profile={profile} />
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
                placeholder="e.g. Switch to the bold template, make scope more detailed, change deposit to 50% flat, add cleanup note, set tax to 8.5%..."
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
