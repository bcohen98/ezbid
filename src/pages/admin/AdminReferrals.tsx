import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminReferrals } from '@/hooks/useAdminData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AdminReferrals() {
  const { data, isLoading } = useAdminReferrals();

  if (isLoading) {
    return (
      <AdminLayout>
        <p className="text-sm text-muted-foreground">Loading referral data...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold">Referrals</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Referrals</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{data?.totalReferrals || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Converted</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{data?.totalConverted || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Credits Issued</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{data?.totalCreditsIssued || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Credits Applied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{data?.totalCreditsApplied || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Top referrers */}
        {data?.topReferrers && data.topReferrers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Referrers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg divide-y">
                {data.topReferrers.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-mono w-6">#{i + 1}</span>
                      <span className="font-medium">{r.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{r.totalReferrals} referred</Badge>
                      <Badge variant="outline" className="bg-success/10 text-success">{r.converted} converted</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All referrals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.referrals || data.referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No referrals yet.</p>
            ) : (
              <div className="border rounded-lg divide-y">
                {data.referrals.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{r.referred_email}</p>
                      <p className="text-xs text-muted-foreground">
                        Referred by {r.referrer_email} · {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className={
                      r.status === 'converted' ? 'bg-success/10 text-success' :
                      r.status === 'signed_up' ? 'bg-primary/10 text-primary' :
                      'bg-muted text-muted-foreground'
                    }>
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
