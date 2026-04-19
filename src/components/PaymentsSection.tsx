import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { DollarSign, Send } from 'lucide-react';
import { formatCurrency } from '@/lib/formatCurrency';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import RequestPaymentModal from '@/components/proposal/RequestPaymentModal';

type PaymentStatus = 'unpaid' | 'deposit_requested' | 'deposit_paid' | 'payment_requested' | 'paid';

interface ProposalLike {
  id: string;
  proposal_number: number;
  title: string | null;
  client_name: string | null;
  client_email?: string | null;
  status?: string | null;
  client_signature_url?: string | null;
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
  const [modalProposal, setModalProposal] = useState<ProposalLike | null>(null);
  const { profile } = useCompanyProfile();
  const connectReady = !!(profile as any)?.stripe_connect_charges_enabled;

  // Signed proposals that are not yet fully paid — eligible for new payment requests.
  const requestableProposals = useMemo(
    () => proposals.filter(p => {
      const isSigned = ['signed', 'accepted', 'work_pending', 'payment_pending', 'closed'].includes(p.status || '') || !!p.client_signature_url;
      const ps = (p.payment_status || 'unpaid') as PaymentStatus;
      return isSigned && ps !== 'paid';
    }),
    [proposals],
  );

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

  // Show the section if there is any payment activity OR if the contractor has signed
  // proposals that could be charged for. This makes Request Payment discoverable
  // from the dashboard the moment a proposal is signed.
  if (paymentProposals.length === 0 && requestableProposals.length === 0) return null;

  const RequestBtn = ({ p, label = 'Request Payment' }: { p: ProposalLike; label?: string }) => {
    if (!connectReady) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled>
                <DollarSign className="h-3 w-3" /> {label}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Connect your bank account in Settings to accept payments</TooltipContent>
        </Tooltip>
      );
    }
    return (
      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setModalProposal(p)}>
        <DollarSign className="h-3 w-3" /> {label}
      </Button>
    );
  };

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
        {/* Signed proposals with no payment yet — quick request */}
        {requestableProposals.filter(p => (p.payment_status || 'unpaid') === 'unpaid').length > 0 && filter !== 'paid' && (
          <div className="mb-4 rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Signed proposals — ready to request payment</p>
            <div className="space-y-1.5">
              {requestableProposals
                .filter(p => (p.payment_status || 'unpaid') === 'unpaid')
                .slice(0, 5)
                .map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link to={`/proposals/${p.id}/preview`} className="flex-1 min-w-0 hover:underline truncate">
                      {p.title || `PRO-${String(p.proposal_number).padStart(4, '0')}`} <span className="text-muted-foreground">· {p.client_name || '—'}</span>
                    </Link>
                    <span className="text-xs font-medium shrink-0">${formatCurrency(Number(p.total) || 0)}</span>
                    <RequestBtn p={p} />
                  </div>
                ))}
            </div>
          </div>
        )}

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
                <th className="text-right font-normal py-2 px-2"></th>
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
                const isPending = ps === 'deposit_requested' || ps === 'payment_requested';
                const isDepositPaid = ps === 'deposit_paid';
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
                    <td className="py-2 px-2 text-right">
                      {isPending && <RequestBtn p={p} label="Resend Link" />}
                      {isDepositPaid && <RequestBtn p={p} label="Request Balance" />}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    No {filter === 'all' ? '' : filter} payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <RequestPaymentModal
        open={!!modalProposal}
        onOpenChange={(o) => { if (!o) setModalProposal(null); }}
        proposal={modalProposal}
        onRequested={() => setModalProposal(null)}
      />
    </Card>
  );
}
