import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AdminAmbassadors() {
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [makeOpen, setMakeOpen] = useState(false);
  const [mEmail, setMEmail] = useState('');
  const [mInitials, setMInitials] = useState('');
  const [making, setMaking] = useState(false);
  const [prospectsOpen, setProspectsOpen] = useState<any | null>(null);
  const [prospects, setProspects] = useState<any[]>([]);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke('admin-list-ambassadors');
    setList((data as any)?.ambassadors || []);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const viewProspects = async (a: any) => {
    setProspectsOpen(a);
    const { data } = await supabase.functions.invoke('admin-list-ambassador-prospects', {
      body: undefined,
    });
    // The function uses query param; call via path
    const { data: { session } } = await supabase.auth.getSession();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-list-ambassador-prospects?ambassador_id=${a.user_id}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${session?.access_token}` } });
    const json = await res.json();
    setProspects(json.prospects || []);
  };

  const approve = async (prospectId: string, approved: boolean) => {
    const { error } = await supabase.functions.invoke('admin-approve-payout', { body: { prospect_id: prospectId, approved } });
    if (error) { toast({ title: 'Failed', variant: 'destructive' }); return; }
    if (prospectsOpen) viewProspects(prospectsOpen);
    refresh();
  };

  const makeAmbassador = async () => {
    if (!mEmail.trim() || !mInitials.trim()) return;
    setMaking(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-make-ambassador', {
        body: { email: mEmail.trim().toLowerCase(), initials: mInitials.trim().toUpperCase() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: `Made ambassador: ${mEmail}` });
      setMakeOpen(false); setMEmail(''); setMInitials('');
      refresh();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setMaking(false); }
  };

  const editInitials = async (a: any) => {
    const next = prompt(`New initials for ${a.email}:`, a.initials);
    if (!next) return;
    const { error } = await supabase.functions.invoke('admin-make-ambassador', {
      body: { target_user_id: a.user_id, initials: next.toUpperCase(), action: 'update_initials' },
    });
    if (!error) refresh();
  };

  return (
    <AdminLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Ambassadors</h1>
          <Button onClick={() => setMakeOpen(true)}>Make Ambassador</Button>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Email</th>
                  <th className="text-left px-3 py-2 font-medium">Initials</th>
                  <th className="text-left px-3 py-2 font-medium">Codes</th>
                  <th className="text-left px-3 py-2 font-medium">Conversions</th>
                  <th className="text-left px-3 py-2 font-medium">Approved</th>
                  <th className="text-left px-3 py-2 font-medium">Pending</th>
                  <th className="text-left px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">No ambassadors yet.</td></tr>
                ) : list.map((a) => (
                  <tr key={a.user_id}>
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.email}</td>
                    <td className="px-3 py-2 font-mono">{a.initials}</td>
                    <td className="px-3 py-2">{a.codes_generated}</td>
                    <td className="px-3 py-2">{a.conversions}</td>
                    <td className="px-3 py-2">{a.approved_payouts}</td>
                    <td className="px-3 py-2">{a.pending_payouts}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => viewProspects(a)}>Prospects</Button>
                        <Button size="sm" variant="ghost" onClick={() => editInitials(a)}>Edit</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={makeOpen} onOpenChange={setMakeOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Make Ambassador</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs">User email</Label><Input value={mEmail} onChange={(e) => setMEmail(e.target.value)} /></div>
            <div><Label className="text-xs">Initials (3 letters)</Label><Input value={mInitials} onChange={(e) => setMInitials(e.target.value.toUpperCase())} maxLength={5} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setMakeOpen(false)}>Cancel</Button>
              <Button onClick={makeAmbassador} disabled={making}>{making ? 'Saving…' : 'Make Ambassador'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!prospectsOpen} onOpenChange={(o) => { if (!o) { setProspectsOpen(null); setProspects([]); } }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader><DialogTitle>Prospects — {prospectsOpen?.name}</DialogTitle></DialogHeader>
          <div className="border rounded overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-medium">Name</th>
                <th className="text-left px-3 py-2 font-medium">Phone</th>
                <th className="text-left px-3 py-2 font-medium">Code</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Payout</th>
                <th />
              </tr></thead>
              <tbody className="divide-y">
                {prospects.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">{p.prospect_name}</td>
                    <td className="px-3 py-2">{p.prospect_phone || '—'}</td>
                    <td className="px-3 py-2 font-mono">{p.code}</td>
                    <td className="px-3 py-2">{p.used ? 'Converted' : (new Date(p.expires_at) < new Date() ? 'Expired' : 'Active')}</td>
                    <td className="px-3 py-2">{p.payout_approved ? 'Approved' : (p.used ? 'Pending' : '—')}</td>
                    <td className="px-3 py-2">
                      {p.used && !p.payout_approved && <Button size="sm" onClick={() => approve(p.id, true)}>Approve payout</Button>}
                      {p.payout_approved && <Button size="sm" variant="ghost" onClick={() => approve(p.id, false)}>Unapprove</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
