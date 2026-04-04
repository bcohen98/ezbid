import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProposal, useProposalLineItems, useProposals } from '@/hooks/useProposals';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { useProposalExhibits } from '@/hooks/useProposalExhibits';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Eye, Copy, Send, Pencil, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatCurrency';
import EditClientDialog from '@/components/EditClientDialog';
import ExhibitsUpload from '@/components/proposal/ExhibitsUpload';
import { supabase } from '@/integrations/supabase/client';

export default function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: proposal, isLoading, refetch } = useProposal(id);
  const { lineItems } = useProposalLineItems(id);
  const { createProposal, updateProposal } = useProposals();
  const { profile } = useCompanyProfile();
  const { exhibits, isAdding, addExhibit, updateCaption, removeExhibit } = useProposalExhibits(id);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleResend = useCallback(async () => {
    if (!proposal) return;
    if (!proposal.client_email) {
      toast({ title: 'Missing client email', description: 'Add a client email before sending.', variant: 'destructive' });
      return;
    }
    setIsSending(true);
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
      setIsSending(false);
    }
  }, [proposal, toast, refetch]);

  if (isLoading) {
    return <AppLayout><div className="container py-8"><p className="text-sm text-muted-foreground">Loading...</p></div></AppLayout>;
  }

  if (!proposal) {
    return <AppLayout><div className="container py-8"><p className="text-sm text-muted-foreground">Proposal not found</p></div></AppLayout>;
  }

  const handleDuplicate = async () => {
    try {
      const { id: _id, created_at, updated_at, proposal_number, user_id, ...rest } = proposal;
      const newProposal = await createProposal({
        ...rest,
        title: `${proposal.title} (Copy)`,
        status: 'draft',
      });
      toast({ title: 'Proposal duplicated' });
      navigate(`/proposals/${newProposal.id}/preview`);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-2xl py-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Button>
          </Link>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground font-mono">PRO-{String(proposal.proposal_number).padStart(4, '0')}</span>
              <Badge variant="outline">{proposal.status}</Badge>
              {proposal.status === 'signed' && proposal.client_signature_url && !(proposal as any).contractor_signature_url && (
                <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">Countersign Required</Badge>
              )}
              {(proposal as any).contractor_signature_url && (
                <Badge variant="outline" className="border-green-400 text-green-700 bg-green-50">Fully Executed</Badge>
              )}
            </div>
            <h1 className="text-2xl font-semibold">{proposal.title || 'Untitled Proposal'}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {proposal.client_name} · {new Date(proposal.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold">${formatCurrency(proposal.total)}</div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <Link to={`/proposals/${id}/preview`}>
            <Button variant="outline" size="sm" className="gap-2"><Eye className="h-4 w-4" /> Preview</Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDuplicate}>
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleResend} disabled={isSending}>
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isSending ? 'Sending…' : 'Resend'}
          </Button>
        </div>

        {/* Summary */}
        <Card>
          <CardContent className="p-6 space-y-4 text-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">Client Info</h3>
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => setEditClientOpen(true)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-muted-foreground">Client:</span> {proposal.client_name}</div>
              <div><span className="text-muted-foreground">Email:</span> {proposal.client_email}</div>
              <div><span className="text-muted-foreground">Phone:</span> {proposal.client_phone || '—'}</div>
              <div><span className="text-muted-foreground">Address:</span> {[proposal.job_site_street, proposal.job_site_city, proposal.job_site_state, proposal.job_site_zip].filter(Boolean).join(', ') || '—'}</div>
              <div><span className="text-muted-foreground">Proposal date:</span> {proposal.proposal_date}</div>
              <div><span className="text-muted-foreground">Valid until:</span> {proposal.valid_until}</div>
              <div><span className="text-muted-foreground">Template:</span> {proposal.template}</div>
              <div><span className="text-muted-foreground">Delivery:</span> {proposal.delivery_method === 'email_self' ? 'Email to self' : 'Client e-sign'}</div>
            </div>
            {lineItems.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-medium mb-2">Line Items</h3>
                {lineItems.map((item) => (
                  <div key={item.id} className="flex justify-between py-1">
                    <span>{item.description} ({item.quantity} {item.unit})</span>
                    <span>${formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>${formatCurrency(proposal.total)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exhibits */}
        <div className="mt-6">
          <ExhibitsUpload
            exhibits={exhibits}
            isAdding={isAdding}
            onAdd={addExhibit}
            onUpdateCaption={updateCaption}
            onRemove={removeExhibit}
          />
        </div>
        {proposal && (
          <EditClientDialog
            open={editClientOpen}
            onOpenChange={setEditClientOpen}
            initialData={{
              client_name: proposal.client_name || '',
              client_email: proposal.client_email || '',
              client_phone: proposal.client_phone || '',
              job_site_street: proposal.job_site_street || '',
              job_site_city: proposal.job_site_city || '',
              job_site_state: proposal.job_site_state || '',
              job_site_zip: proposal.job_site_zip || '',
            }}
            onSave={async (data) => {
              await updateProposal({ id: proposal.id, ...data });
              await refetch();
              toast({ title: 'Client info updated' });
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
