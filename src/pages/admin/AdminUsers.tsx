import { useState, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminUsers } from '@/hooks/useAdminData';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AdminUsers() {
  const { data, isLoading, refetch } = useAdminUsers();
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Grant dialog state
  const [grantUser, setGrantUser] = useState<any>(null);
  const [grantCount, setGrantCount] = useState(3);
  const [granting, setGranting] = useState(false);

  const filtered = useMemo(() => {
    if (!data?.users) return [];
    if (!search) return data.users;
    const q = search.toLowerCase();
    return data.users.filter((u: any) => u.email?.toLowerCase().includes(q));
  }, [data, search]);

  const handleGrant = async () => {
    if (!grantUser) return;
    setGranting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-grant-proposals', {
        body: { target_user_id: grantUser.userId, grant_count: grantCount },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      toast({ title: `Granted ${grantCount} additional proposals to ${grantUser.email}` });
      setGrantUser(null);
      refetch();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to grant proposals', variant: 'destructive' });
    } finally {
      setGranting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Users</h1>
          <Input
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading users...</p>
        ) : (
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium">Email</th>
                  <th className="text-left px-4 py-2 font-medium">Signup Date</th>
                  <th className="text-left px-4 py-2 font-medium">Plan</th>
                  <th className="text-left px-4 py-2 font-medium">Proposals</th>
                  <th className="text-left px-4 py-2 font-medium">Last Active</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u: any, i: number) => (
                  <tr
                    key={i}
                    className={cn(
                      'hover:bg-muted/30 transition-colors',
                      u.hitFreeLimit && 'bg-yellow-50'
                    )}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-2">{new Date(u.signupDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <Badge variant={u.plan === 'Paid' ? 'default' : 'secondary'}>{u.plan}</Badge>
                    </td>
                    <td className="px-4 py-2">{u.proposalsUsed}</td>
                    <td className="px-4 py-2">{new Date(u.lastActive).toLocaleDateString()}</td>
                    <td className="px-4 py-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          u.status === 'Subscriber' && 'bg-green-50 text-green-700 border-green-200',
                          u.status === 'Hit free limit' && 'bg-yellow-50 text-yellow-700 border-yellow-200',
                        )}
                      >
                        {u.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      {u.status !== 'Subscriber' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setGrantUser(u); setGrantCount(3); }}
                        >
                          Grant Proposals
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
            )}
          </div>
        )}
      </div>

      {/* Grant Dialog */}
      <Dialog open={!!grantUser} onOpenChange={(open) => !open && setGrantUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Grant Free Proposals</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Grant additional free proposals to <strong>{grantUser?.email}</strong>
            </p>
            <div>
              <Label className="text-sm">Additional free proposals to grant</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={grantCount}
                onChange={e => setGrantCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setGrantUser(null)} disabled={granting}>Cancel</Button>
              <Button onClick={handleGrant} disabled={granting}>
                {granting ? 'Granting…' : 'Grant'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
