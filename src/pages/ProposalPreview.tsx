import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProposal, useProposalLineItems, useProposals } from '@/hooks/useProposals';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import AppLayout from '@/components/AppLayout';
import ProposalDocument from '@/components/proposal/ProposalDocument';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, Mail, Sparkles, Loader2 } from 'lucide-react';
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

  const handleSendSelf = () => {
    toast({ title: 'Coming soon', description: 'PDF generation and email sending will be enabled in Phase 2.' });
  };

  const handleSendClient = () => {
    toast({ title: 'Coming soon', description: 'E-signature flow will be enabled in Phase 3.' });
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

          {/* Edit panel */}
          <div className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> AI Revision
              </h3>
              <Textarea
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="e.g. Make the scope of work more detailed, add a note about cleanup being included, change the payment terms to Net 30."
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

            <div className="space-y-2">
              <Button className="w-full gap-2" onClick={handleSendSelf}>
                <Mail className="h-4 w-4" /> Send to my email
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={handleSendClient}>
                <Send className="h-4 w-4" /> Send to client for e-signature
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
