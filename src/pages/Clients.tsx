import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useProposals } from '@/hooks/useProposals';
import { formatCurrency } from '@/lib/formatCurrency';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, ArrowUpDown, Users } from 'lucide-react';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-700',
  signed: 'bg-green-100 text-green-700',
  accepted: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  expired: 'bg-orange-100 text-orange-700',
  work_pending: 'bg-yellow-100 text-yellow-700',
  payment_pending: 'bg-purple-100 text-purple-700',
  closed: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  signed: 'Signed',
  accepted: 'Accepted',
  denied: 'Denied',
  expired: 'Expired',
  work_pending: 'Work Pending',
  payment_pending: 'Payment Pending',
  closed: 'Closed',
};

type SortKey = 'date' | 'title' | 'total' | 'status';
type SortDir = 'asc' | 'desc';

export default function Clients() {
  const { proposals, isLoading } = useProposals();
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const clientGroups = useMemo(() => {
    const groups: Record<string, typeof proposals> = {};
    for (const p of proposals) {
      const key = (p.client_email || p.client_name || 'Unknown Client').toLowerCase().trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    // Sort proposals within each group
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        let cmp = 0;
        if (sortKey === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        else if (sortKey === 'title') cmp = (a.title || '').localeCompare(b.title || '');
        else if (sortKey === 'total') cmp = Number(a.total || 0) - Number(b.total || 0);
        else if (sortKey === 'status') cmp = (a.status || '').localeCompare(b.status || '');
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return groups;
  }, [proposals, sortKey, sortDir]);

  const clientList = useMemo(() => {
    return Object.entries(clientGroups)
      .map(([key, props]) => ({
        key,
        name: props[0].client_name || props[0].client_email || 'Unknown Client',
        email: props[0].client_email,
        proposals: props,
        totalValue: props.reduce((sum, p) => sum + Number(p.total || 0), 0),
        latestDate: props.reduce((latest, p) => {
          const d = new Date(p.created_at);
          return d > latest ? d : latest;
        }, new Date(0)),
      }))
      .sort((a, b) => b.latestDate.getTime() - a.latestDate.getTime());
  }, [clientGroups]);

  const toggleClient = (key: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (isLoading) {
    return <AppLayout><div className="container py-8"><p className="text-sm text-muted-foreground">Loading clients...</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="container py-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <h1 className="text-xl font-semibold">Clients</h1>
            <Badge variant="secondary" className="ml-2">{clientList.length}</Badge>
          </div>
          <div className="flex gap-1">
            {(['date', 'title', 'total', 'status'] as SortKey[]).map(k => (
              <Button
                key={k}
                variant={sortKey === k ? 'default' : 'ghost'}
                size="sm"
                className="text-xs gap-1"
                onClick={() => toggleSort(k)}
              >
                {k.charAt(0).toUpperCase() + k.slice(1)}
                {sortKey === k && <ArrowUpDown className="h-3 w-3" />}
              </Button>
            ))}
          </div>
        </div>

        {clientList.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No proposals yet. Create your first proposal to see clients here.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {clientList.map(client => {
              const isExpanded = expandedClients.has(client.key);
              return (
                <Card key={client.key}>
                  <CardHeader
                    className="cursor-pointer py-3 px-4"
                    onClick={() => toggleClient(client.key)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <CardTitle className="text-sm font-medium">{client.name}</CardTitle>
                          {client.email && <p className="text-xs text-muted-foreground">{client.email}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{client.proposals.length} proposal{client.proposals.length !== 1 ? 's' : ''}</span>
                        <span className="font-medium">${formatCurrency(client.totalValue)}</span>
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="pt-0 pb-3 px-4">
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                              <th className="text-left py-2 px-3">Date</th>
                              <th className="text-left py-2 px-3">Description</th>
                              <th className="text-right py-2 px-3">Amount</th>
                              <th className="text-center py-2 px-3">Status</th>
                              <th className="text-right py-2 px-3"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {client.proposals.map(p => (
                              <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/30 transition-colors">
                                <td className="py-2 px-3 text-xs text-muted-foreground whitespace-nowrap">
                                  {new Date(p.created_at).toLocaleDateString()}
                                </td>
                                <td className="py-2 px-3">
                                  {p.title || `Proposal #${p.proposal_number}`}
                                </td>
                                <td className="py-2 px-3 text-right font-medium">
                                  ${formatCurrency(p.total)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <Badge className={`text-xs ${statusColors[p.status] || ''}`}>
                                    {statusLabels[p.status] || p.status}
                                  </Badge>
                                </td>
                                <td className="py-2 px-3 text-right">
                                  <Link to={`/proposals/${p.id}`}>
                                    <Button variant="ghost" size="sm" className="text-xs h-7">View</Button>
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
