import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useProposals } from '@/hooks/useProposals';
import { useSubscription } from '@/hooks/useSubscription';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, FileText, AlertCircle, PenLine, X, Search, ArrowUpDown, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatCurrency';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-primary/10 text-primary',
  signed: 'bg-success/10 text-success',
  accepted: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  expired: 'bg-destructive/10 text-destructive',
  work_pending: 'bg-yellow-100 text-yellow-700',
  payment_pending: 'bg-purple-100 text-purple-700',
  closed: 'bg-muted text-muted-foreground',
};

type TabKey = 'all' | 'signed' | 'sent' | 'draft';
type SortKey = 'date' | 'client' | 'total' | 'status';
type SortDir = 'asc' | 'desc';

export default function Dashboard() {
  const navigate = useNavigate();
  const { proposals, isLoading: proposalsLoading, deleteProposal } = useProposals();
  const { subscription, isLoading: subLoading } = useSubscription();
  const { profileCompletion, isLoading: profileLoading } = useCompanyProfile();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  // Check for unsaved draft in localStorage
  const [draftDismissed, setDraftDismissed] = useState(false);
  const unsavedDraft = useMemo(() => {
    if (draftDismissed) return null;
    try {
      const saved = localStorage.getItem('ezbid_proposal_draft');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      const hasContent = parsed.client_name || parsed.title || parsed.job_description ||
        parsed.line_items?.some((li: any) => li.description);
      return hasContent ? parsed : null;
    } catch { return null; }
  }, [draftDismissed]);

  const discardDraft = () => {
    localStorage.removeItem('ezbid_proposal_draft');
    setDraftDismissed(true);
  };

  const isActive = subscription?.status === 'active';
  const proposalsUsed = subscription?.proposals_used ?? 0;

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'signed', label: 'Signed' },
    { key: 'sent', label: 'Pending Signature' },
    { key: 'draft', label: 'Incomplete' },
  ];

  const filteredProposals = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = activeTab === 'all'
      ? proposals
      : proposals.filter((p) => p.status === activeTab);

    if (q) {
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.client_name || '').toLowerCase().includes(q) ||
        (p.client_email || '').toLowerCase().includes(q) ||
        `PRO-${String(p.proposal_number).padStart(4, '0')}`.toLowerCase().includes(q)
      );
    }

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      else if (sortKey === 'client') cmp = (a.client_name || '').localeCompare(b.client_name || '');
      else if (sortKey === 'total') cmp = Number(a.total || 0) - Number(b.total || 0);
      else if (sortKey === 'status') cmp = (a.status || '').localeCompare(b.status || '');
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return sorted;
  }, [proposals, activeTab, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

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
                {isActive ? 'Active — $29/mo' : 'Free tier'}
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

        {/* Tabs + Create */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 border rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === tab.key
                    ? 'bg-foreground text-background font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <Button onClick={() => navigate('/proposals/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Create New Proposal
          </Button>
        </div>

        {/* Search + Sort */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search proposals..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1">
            {(['date', 'client', 'total', 'status'] as SortKey[]).map(k => (
              <Button
                key={k}
                variant={sortKey === k ? 'default' : 'ghost'}
                size="sm"
                className="text-xs gap-1"
                onClick={() => toggleSort(k)}
              >
                {k.charAt(0).toUpperCase() + k.slice(1)}
                <SortIcon k={k} />
              </Button>
            ))}
          </div>
        </div>

        {/* Proposals list */}
        {proposalsLoading ? (
          <p className="text-sm text-muted-foreground">Loading proposals...</p>
        ) : filteredProposals.length === 0 && !unsavedDraft ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">
                {search ? 'No proposals match your search' : activeTab === 'all' ? 'No proposals yet' : `No ${tabs.find(t => t.key === activeTab)?.label.toLowerCase()} proposals`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Create your first professional proposal in minutes.</p>
              {activeTab === 'all' && !search && (
                <Button onClick={() => navigate('/proposals/new')} className="mt-4 gap-2" size="sm">
                  <Plus className="h-4 w-4" />
                  Create Proposal
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg divide-y">
            {/* Unsaved draft row */}
            {unsavedDraft && (activeTab === 'all' || activeTab === 'draft') && (
              <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">DRAFT</span>
                    <span className="text-sm font-medium truncate">{unsavedDraft.title || unsavedDraft.client_name || 'Untitled proposal'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {unsavedDraft.client_name || 'No client'} · {unsavedDraft.template} template
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700">incomplete</Badge>
                  <Button variant="outline" size="sm" onClick={() => navigate('/proposals/new')} className="gap-1.5">
                    <PenLine className="h-3.5 w-3.5" /> Resume
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={discardDraft}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
            {filteredProposals.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <Link
                  to={`/proposals/${p.id}`}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">PRO-{String(p.proposal_number).padStart(4, '0')}</span>
                    <span className="text-sm font-medium truncate">{p.title || 'Untitled'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.client_name || 'No client'} · {new Date(p.created_at).toLocaleDateString()}
                  </p>
                </Link>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">${formatCurrency(p.total)}</span>
                  <Badge variant="outline" className={statusColors[p.status] || ''}>
                    {p.status}
                  </Badge>
                  {p.status === 'draft' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (window.confirm('Delete this draft proposal?')) {
                          deleteProposal(p.id).then(() => {
                            toast.success('Draft deleted');
                          }).catch(() => {
                            toast.error('Failed to delete');
                          });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
