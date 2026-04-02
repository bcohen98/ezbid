import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProposal, useProposalLineItems, useProposals } from '@/hooks/useProposals';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Eye, Copy, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ProposalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: proposal, isLoading } = useProposal(id);
  const { lineItems } = useProposalLineItems(id);
  const { createProposal } = useProposals();
  const { profile } = useCompanyProfile();

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
            </div>
            <h1 className="text-2xl font-semibold">{proposal.title || 'Untitled Proposal'}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {proposal.client_name} · {new Date(proposal.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold">${Number(proposal.total || 0).toLocaleString()}</div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <Link to={`/proposals/${id}/preview`}>
            <Button variant="outline" size="sm" className="gap-2"><Eye className="h-4 w-4" /> Preview</Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleDuplicate}>
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast({ title: 'Coming soon' })}>
            <Send className="h-4 w-4" /> Resend
          </Button>
        </div>

        {/* Summary */}
        <Card>
          <CardContent className="p-6 space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-muted-foreground">Client:</span> {proposal.client_name}</div>
              <div><span className="text-muted-foreground">Email:</span> {proposal.client_email}</div>
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
                    <span>${Number(item.subtotal).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>${Number(proposal.total || 0).toFixed(2)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
