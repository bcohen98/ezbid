import { useState, useMemo } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminUsers } from '@/hooks/useAdminData';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AdminUsers() {
  const { data, isLoading } = useAdminUsers();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!data?.users) return [];
    if (!search) return data.users;
    const q = search.toLowerCase();
    return data.users.filter((u: any) => u.email?.toLowerCase().includes(q));
  }, [data, search]);

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
    </AdminLayout>
  );
}
