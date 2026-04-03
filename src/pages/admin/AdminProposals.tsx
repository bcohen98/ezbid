import { useState, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminProposals } from '@/hooks/useAdminData';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/formatCurrency';

const statusOptions = ['all', 'draft', 'sent', 'signed', 'expired', 'accepted', 'denied', 'work_pending', 'payment_pending', 'closed'];

export default function AdminProposals() {
  const { data, isLoading } = useAdminProposals();
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = useMemo(() => {
    if (!data?.proposals) return [];
    if (statusFilter === 'all') return data.proposals;
    return data.proposals.filter((p: any) => p.status === statusFilter);
  }, [data, statusFilter]);

  return (
    <AdminLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Proposals</h1>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === 'all' ? 'All statuses' : s.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading proposals...</p>
        ) : (
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium">Proposal #</th>
                  <th className="text-left px-4 py-2 font-medium">Contractor</th>
                  <th className="text-left px-4 py-2 font-medium">Client</th>
                  <th className="text-left px-4 py-2 font-medium">Trade</th>
                  <th className="text-left px-4 py-2 font-medium">Total</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs">
                      PRO-{String(p.proposalNumber).padStart(4, '0')}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{p.contractorEmail}</td>
                    <td className="px-4 py-2">{p.clientName}</td>
                    <td className="px-4 py-2 capitalize">{p.tradeType?.replace('_', ' ')}</td>
                    <td className="px-4 py-2">${formatCurrency(p.total)}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="capitalize">{p.status.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-2">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No proposals found.</p>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
