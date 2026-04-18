import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';

type PaymentStatus = 'unpaid' | 'deposit_requested' | 'deposit_paid' | 'payment_requested' | 'paid';

interface ProposalLike {
  id: string;
  proposal_number: number;
  title: string | null;
  client_name: string | null;
  total: number | null;
  deposit_amount: number | null;
  deposit_paid_amount?: number | null;
  payment_paid_amount?: number | null;
  payment_status?: string | null;
  payment_requested_at?: string | null;
  payment_paid_at?: string | null;
}

type Filter = 'all' | 'pending' | 'paid';

interface Props {
  proposals: ProposalLike[];
}

export default function PaymentsSection({ proposals }: Props) {
  const [filter, setFilter] = useState<Filter>('all');

  const paymentProposals = useMemo(
    () => proposals.filter(p => {
      const ps = (p.payment_status || 'unpaid') as PaymentStatus;
      return ps !== 'unpaid';
    }),
    [proposals],
  );

  const monthTotal = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return paymentProposals.reduce((sum, p) => {
      const paidAt = p.payment_paid_at ? new Date(p.payment_paid_at).getTime() : 0;
      const ps = p.payment_status as PaymentStatus;
      if (ps === 'paid' && paidAt >= monthStart) {
        return sum + (Number(p.payment_paid_amount) || Number(p.total) || 0);
      }
      if (ps === 'deposit_paid' && paidAt >= monthStart) {
        return sum + (Number(p.deposit_paid_amount) || 0);
      }
      return sum;
    }, 0);
  }, [paymentProposals]);

  const filtered = useMemo(() => {
    return paymentProposals.filter(p => {
      const ps = (p.payment_status || 'unpaid') as PaymentStatus;
      if (filter === 'pending') return ps === 'deposit_requested' || ps === 'payment_requested';
      if (filter === 'paid') return ps === 'deposit_paid' || ps === 'paid';
      return true;
    }).sort((a, b) => {
      const ad = a.payment_paid_at || a.payment_requested_at || '';
      const bd = b.payment_paid_at || b.payment_requested_at || '';
      return bd.localeCompare(ad);
    });
  }, [paymentProposals, filter]);

  if (paymentProposals.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Payments
          </CardTitle>
          <p className="text-2xl font-semibold mt-1">${formatCurrency(monthTotal)}</p>
          <p className="text-xs text-muted-foreground">received this month</p>
        </div>
        <div className="flex items-center gap-1 border rounded-lg p-1">
          {(['all', 'pending', 'paid'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md transition-colors capitalize ${
                filter === f ? 'bg-foreground text-background font-medium' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left font-normal py-2 px-2">Proposal</th>
                <th className="text-left font-normal py-2 px-2">Client</th>
                <th className="text-right font-normal py-2 px-2">Requested</th>
                <th className="text-right font-normal py-2 px-2">Received</th>
                <th className="text-left font-normal py-2 px-2">Status</th>
                <th className="text-left font-normal py-2 px-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const ps = (p.payment_status || 'unpaid') as PaymentStatus;
                const requested = ps === 'deposit_requested' ? Number(p.deposit_amount) || 0 : Number(p.total) || 0;
                const received = ps === 'paid'
                  ? Number(p.payment_paid_amount) || 0
                  : ps === 'deposit_paid'
                    ? Number(p.deposit_paid_amount) || 0
                    : 0;
                const dateStr = (p.payment_paid_at || p.payment_requested_at)
                  ? new Date((p.payment_paid_at || p.payment_requested_at) as string).toLocaleDateString()
                  : '—';
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 px-2">
                      <Link to={`/proposals/${p.id}/preview`} className="font-medium hover:underline">
                        {p.title || `PRO-${String(p.proposal_number).padStart(4, '0')}`}
                      </Link>
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{p.client_name || '—'}</td>
                    <td className="py-2 px-2 text-right">${formatCurrency(requested)}</td>
                    <td className="py-2 px-2 text-right">{received > 0 ? `$${formatCurrency(received)}` : '—'}</td>
                    <td className="py-2 px-2">
                      {ps === 'deposit_requested' && <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">Deposit Pending</Badge>}
                      {ps === 'payment_requested' && <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">Payment Pending</Badge>}
                      {ps === 'deposit_paid' && <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">Deposit Paid</Badge>}
                      {ps === 'paid' && <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">Paid</Badge>}
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{dateStr}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    No {filter === 'all' ? '' : filter} payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
