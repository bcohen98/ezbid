import { useNavigate, Link } from 'react-router-dom';
import { useProposals } from '@/hooks/useProposals';
import { useSubscription } from '@/hooks/useSubscription';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, AlertCircle } from 'lucide-react';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  signed: 'bg-success/10 text-success',
  expired: 'bg-destructive/10 text-destructive',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { proposals, isLoading: proposalsLoading } = useProposals();
  const { subscription, isLoading: subLoading } = useSubscription();
  const { profileCompletion, isLoading: profileLoading } = useCompanyProfile();

  const isActive = subscription?.status === 'active';
  const proposalsUsed = subscription?.proposals_used ?? 0;

  return (
    <AppLayout>
      <div className="container py-8 space-y-6 animate-fade-in">
        {/* Profile completion banner */}
        {!profileLoading && profileCompletion < 100 && (
          <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4">
            <AlertCircle className="h-5 w-5 text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Complete your company profile</p>
              <p className="text-xs text-muted-foreground">
                A complete profile makes your proposals look more professional.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={profileCompletion} className="w-24 h-2" />
              <span className="text-xs text-muted-foreground font-medium">{profileCompletion}%</span>
              <Link to="/company-profile">
                <Button variant="outline" size="sm">Complete</Button>
              </Link>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Proposals</CardTitle>
            </CardHeader>
            <CardContent>
              {isActive ? (
                <p className="text-2xl font-semibold">{proposals.length} <span className="text-sm text-muted-foreground font-normal">total</span></p>
              ) : (
                <p className="text-2xl font-semibold">{proposalsUsed} <span className="text-sm text-muted-foreground font-normal">of 3 free</span></p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={isActive ? 'default' : 'secondary'}>
                {isActive ? 'Active — $79/mo' : 'Free tier'}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Progress value={profileCompletion} className="flex-1 h-2" />
                <span className="text-sm font-medium">{profileCompletion}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create New */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Proposals</h2>
          <Button onClick={() => navigate('/proposals/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create New Proposal
          </Button>
        </div>

        {/* Proposals list */}
        {proposalsLoading ? (
          <p className="text-sm text-muted-foreground">Loading proposals...</p>
        ) : proposals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">No proposals yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first professional proposal in minutes.</p>
              <Button onClick={() => navigate('/proposals/new')} className="mt-4 gap-2" size="sm">
                <Plus className="h-4 w-4" />
                Create Proposal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg divide-y">
            {proposals.map((p) => (
              <Link
                key={p.id}
                to={`/proposals/${p.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">PRO-{String(p.proposal_number).padStart(4, '0')}</span>
                    <span className="text-sm font-medium truncate">{p.title || 'Untitled'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.client_name || 'No client'} · {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">${Number(p.total || 0).toLocaleString()}</span>
                  <Badge variant="outline" className={statusColors[p.status] || ''}>
                    {p.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
