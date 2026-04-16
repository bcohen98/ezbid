import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatCurrency';
import { DollarSign, TrendingUp, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';

interface EarningsData {
  total_collected: number;
  total_stripe_fees: number;
  total_platform_fees: number;
  total_net: number;
  this_month: { collected: number; net: number };
  this_year: { collected: number; net: number };
  pending_amount: number;
  by_month: { month: string; amount: number; fees: number; net: number }[];
  recent_transactions: {
    id: string;
    date: string;
    proposal_title: string;
    client_name: string;
    amount: number;
    stripe_fee: number;
    platform_fee: number;
    net_amount: number;
    status: string;
    type: string;
    proposal_id: string;
  }[];
}

export default function Earnings() {
  const { profile } = useCompanyProfile();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const isConnected = (profile as any)?.stripe_connect_charges_enabled;

  useEffect(() => {
    if (!isConnected) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-contractor-earnings');
        if (error) throw error;
        setEarnings(data);
      } catch (err: any) {
        toast({ title: 'Failed to load earnings', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [isConnected]);

  const statusColor = (s: string) => {
    if (s === 'succeeded') return 'bg-green-100 text-green-800';
    if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (s === 'failed') return 'bg-red-100 text-red-800';
    return '';
  };

  return (
    <AppLayout>
      <div className="container max-w-4xl px-4 py-6 md:py-8 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold">Earnings</h1>
          <p className="text-sm text-muted-foreground mt-1">Payments collected through EZ-Bid</p>
        </div>

        {!isConnected ? (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground" />
              <h2 className="text-lg font-semibold">Connect your bank account to start collecting payments</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Once connected, you can request deposits and payments directly from signed proposals. Clients pay by card or bank transfer.
              </p>
              <Link to="/company-profile">
                <Button className="gap-2">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : earnings ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">This Month</p>
                  <p className="text-xl font-semibold mt-1">${formatCurrency(earnings.this_month.collected)}</p>
                  <p className="text-xs text-muted-foreground">Net: ${formatCurrency(earnings.this_month.net)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">This Year</p>
                  <p className="text-xl font-semibold mt-1">${formatCurrency(earnings.this_year.collected)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</p>
                  <p className="text-xl font-semibold mt-1">${formatCurrency(earnings.pending_amount)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> All Time</p>
                  <p className="text-xl font-semibold mt-1">${formatCurrency(earnings.total_net)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            {earnings.by_month.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Monthly Collections</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={earnings.by_month}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                            name === 'amount' ? 'Collected' : name === 'net' ? 'Net' : 'Fees'
                          ]}
                        />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent transactions */}
            <Card>
              <CardHeader><CardTitle className="text-base">Recent Transactions</CardTitle></CardHeader>
              <CardContent>
                {earnings.recent_transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No payments collected yet. Request your first payment from a signed proposal.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Proposal</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Fees</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {earnings.recent_transactions.map(txn => (
                        <TableRow
                          key={txn.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/proposals/${txn.proposal_id}`)}
                        >
                          <TableCell className="text-xs">{new Date(txn.date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-sm">{txn.proposal_title}</TableCell>
                          <TableCell className="text-sm">{txn.client_name}</TableCell>
                          <TableCell className="text-right text-sm">${formatCurrency(txn.amount)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            ${formatCurrency((txn.stripe_fee || 0) + (txn.platform_fee || 0))}
                          </TableCell>
                          <TableCell className="text-right text-sm">${formatCurrency(txn.net_amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusColor(txn.status)}>
                              {txn.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
