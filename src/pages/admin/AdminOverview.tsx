import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminOverview } from '@/hooks/useAdminData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminOverview() {
  const { data, isLoading } = useAdminOverview();

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-lg font-semibold">Overview</h1>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading metrics...</p>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Total Users" value={data.totalUsers} />
              <MetricCard label="Signups This Week" value={data.signupsThisWeek} />
              <MetricCard label="Signups Today" value={data.signupsToday} />
              <MetricCard label="Active Subscribers" value={data.activeSubscribers} />
              <MetricCard label="MRR" value={`$${data.mrr.toLocaleString()}`} />
              <MetricCard label="Total Proposals" value={data.totalProposals} />
              <MetricCard label="Proposals This Week" value={data.proposalsThisWeek} />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Proposals by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(data.statusCounts || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between border rounded-md px-3 py-2">
                      <span className="text-sm capitalize">{status.replace('_', ' ')}</span>
                      <span className="text-sm font-semibold">{count as number}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
