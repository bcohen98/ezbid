import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check } from 'lucide-react';

export default function AmbassadorDashboard() {
  const { user } = useAuth();
  const { data: roleData, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [prospects, setProspects] = useState<any[]>([]);
  const [ambProfile, setAmbProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // New prospect modal
  const [openNew, setOpenNew] = useState(false);
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Grant
  const [grantEmail, setGrantEmail] = useState('');
  const [grantAmount, setGrantAmount] = useState(1);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    if (!roleLoading && roleData && !roleData.isAmbassador) {
      navigate('/dashboard', { replace: true });
    }
  }, [roleLoading, roleData, navigate]);

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: pros }, { data: prof }] = await Promise.all([
      supabase.from('ambassador_prospects').select('*').order('created_at', { ascending: false }),
      supabase.from('ambassador_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    setProspects(pros || []);
    setAmbProfile(prof);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, [user?.id]);

  const handleGenerate = async () => {
    if (!pName.trim()) { toast({ title: 'Prospect name required', variant: 'destructive' }); return; }
    setGenerating(true);
    setGeneratedCode('');
    try {
      const { data, error } = await supabase.functions.invoke('ambassador-create-prospect', {
        body: { prospect_name: pName, prospect_phone: pPhone, notes: pNotes },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setGeneratedCode((data as any).prospect.code);
      setPName(''); setPPhone(''); setPNotes('');
      refresh();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setGenerating(false); }
  };

  const handleGrant = async () => {
    if (!grantEmail.trim()) return;
    setGranting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ambassador-grant-proposals', {
        body: { recipient_email: grantEmail.trim().toLowerCase(), amount: grantAmount },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: `Granted ${grantAmount} proposals to ${grantEmail}` });
      setGrantEmail(''); setGrantAmount(1);
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setGranting(false); }
  };

  const stats = {
    codes: prospects.length,
    conversions: prospects.filter((p) => p.used).length,
    approved: prospects.filter((p) => p.payout_approved).length,
    pending: prospects.filter((p) => p.used && !p.payout_approved).length,
  };

  const statusOf = (p: any) => p.used ? 'Converted' : (new Date(p.expires_at) < new Date() ? 'Expired' : 'Active');

  return (
    <AppLayout>
      <div className="container max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Ambassador Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Initials: <span className="font-mono font-semibold">{ambProfile?.initials || '—'}</span></p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Codes generated', val: stats.codes },
            { label: 'Conversions', val: stats.conversions },
            { label: 'Approved payouts', val: stats.approved },
            { label: 'Pending payouts', val: stats.pending },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-1">{s.val}</p>
            </div>
          ))}
        </div>

        {/* Prospects */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">My Prospects</h2>
            <Button onClick={() => { setOpenNew(true); setGeneratedCode(''); }}>+ New Prospect</Button>
          </div>
          <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Phone</th>
                  <th className="text-left px-3 py-2 font-medium">Code</th>
                  <th className="text-left px-3 py-2 font-medium">Generated</th>
                  <th className="text-left px-3 py-2 font-medium">Expires</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>
                ) : prospects.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No prospects yet. Click "+ New Prospect" to generate a code.</td></tr>
                ) : prospects.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">{p.prospect_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.prospect_phone || '—'}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{p.code}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(p.expires_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{statusOf(p)}</td>
                    <td className="px-3 py-2">{p.payout_approved ? 'Approved' : (p.used ? 'Pending' : '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Grant proposals */}
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-lg font-semibold mb-3">Grant Proposals</h2>
          <p className="text-sm text-muted-foreground mb-4">Give an existing user up to 3 extra free proposals.</p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-3 items-end">
            <div>
              <Label className="text-xs">User email</Label>
              <Input value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div>
              <Label className="text-xs">Amount</Label>
              <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={grantAmount} onChange={(e) => setGrantAmount(parseInt(e.target.value))}>
                <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
              </select>
            </div>
            <Button onClick={handleGrant} disabled={granting || !grantEmail.trim()}>{granting ? 'Granting…' : 'Grant'}</Button>
          </div>
        </section>
      </div>

      {/* New Prospect dialog */}
      <Dialog open={openNew} onOpenChange={(o) => { if (!o) { setOpenNew(false); setGeneratedCode(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Prospect</DialogTitle></DialogHeader>
          {generatedCode ? (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">Read this code to your prospect on the call. Valid for 5 days.</p>
              <div className="rounded-lg border-2 border-foreground bg-muted p-6 text-center">
                <p className="font-mono font-bold text-3xl tracking-wider">{generatedCode}</p>
              </div>
              <Button className="w-full gap-2" variant="outline" onClick={() => { navigator.clipboard.writeText(generatedCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy code</>}
              </Button>
              <Button className="w-full" onClick={() => { setOpenNew(false); setGeneratedCode(''); }}>Done</Button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div><Label className="text-xs">Prospect name *</Label><Input value={pName} onChange={(e) => setPName(e.target.value)} /></div>
              <div><Label className="text-xs">Prospect phone</Label><Input value={pPhone} onChange={(e) => setPPhone(e.target.value)} placeholder="(555) 123-4567" /></div>
              <div><Label className="text-xs">Notes</Label><Input value={pNotes} onChange={(e) => setPNotes(e.target.value)} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpenNew(false)}>Cancel</Button>
                <Button onClick={handleGenerate} disabled={generating || !pName.trim()}>{generating ? 'Generating…' : 'Generate Code'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
