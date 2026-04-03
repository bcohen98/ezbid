import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminRevenue } from '@/hooks/useAdminData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminRevenue() {
  const { data, isLoading } = useAdminRevenue();

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-lg font-semibold">Revenue</h1>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading revenue data...</p>
        ) : data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Active Subscribers" value={data.activeSubscribers} />
            <MetricCard label="MRR" value={`$${data.mrr.toLocaleString()}`} />
            <MetricCard label="New This Month" value={data.newSubscribersThisMonth} />
            <MetricCard label="Cancellations" value={data.cancellationsThisMonth} />
          </div>
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
