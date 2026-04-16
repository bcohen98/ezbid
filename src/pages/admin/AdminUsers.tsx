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
import { Brain, Loader2, Mail } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  free_credits: {
    subject: 'I added more free credits to your EZ-Bid account',
    body: `Hey [first name],

I noticed you used all 3 of your free credits — that tells me you were actually putting EZ-Bid to work, and I appreciate that.

I went ahead and added more credits to your account so you can keep going.

I'd also love to show you everything the platform can do. I'm offering a free demo — guaranteed 5 minutes or less. If you're interested, give me a call or text at (954) 200-9149.

Thanks,
Brett Cohen
EZ-Bid`,
  },
  check_in: {
    subject: 'Quick check-in from EZ-Bid',
    body: `Hey [first name],

Just wanted to check in and see how things are going with EZ-Bid. If you have any questions or ran into anything, I'm easy to reach — just reply here or call/text me at (954) 200-9149.

Thanks,
Brett Cohen
EZ-Bid`,
  },
};

function getFirstName(email: string): string {
  if (!email) return 'there';
  const local = email.split('@')[0];
  const first = local.split(/[._-]/)[0];
  if (!first || /\d/.test(first)) return 'there';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export default function AdminUsers() {
  const { data, isLoading, refetch } = useAdminUsers();
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  // Grant dialog state
  const [grantUser, setGrantUser] = useState<any>(null);
  const [grantCount, setGrantCount] = useState(3);
  const [granting, setGranting] = useState(false);

  // Intelligence dialog state
  const [intelUser, setIntelUser] = useState<any>(null);
  const [intelData, setIntelData] = useState<any>(null);
  const [intelLoading, setIntelLoading] = useState(false);

  // Email dialog state
  const [emailUser, setEmailUser] = useState<any>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const openEmailDialog = (u: any) => {
    setEmailUser(u);
    setEmailTemplate('');
    setEmailSubject('');
    setEmailBody('');
  };

  const applyTemplate = (key: string) => {
    setEmailTemplate(key);
    const tpl = EMAIL_TEMPLATES[key];
    if (!tpl || !emailUser) return;
    const firstName = getFirstName(emailUser.email);
    setEmailSubject(tpl.subject);
    setEmailBody(tpl.body.replace(/\[first name\]/g, firstName));
  };

  const handleSendEmail = async () => {
    if (!emailUser || !emailSubject.trim() || !emailBody.trim()) {
      toast({ title: 'Subject and body are required', variant: 'destructive' });
      return;
    }
    setSendingEmail(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-send-email', {
        body: { to: emailUser.email, subject: emailSubject, body: emailBody },
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      toast({ title: `Email sent to ${emailUser.email}` });
      setEmailUser(null);
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSendingEmail(false);
    }
  };

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

  const handleViewIntelligence = async (u: any) => {
    setIntelUser(u);
    setIntelData(null);
    setIntelLoading(true);
    try {
      // Fetch from cache table
      const { data: cacheRows } = await supabase
        .from('user_intelligence_cache' as any)
        .select('*')
        .eq('user_id', u.userId)
        .limit(1);
      let row = (cacheRows as any)?.[0] || null;

      // If no cache exists and user has proposals, trigger a build
      if (!row && u.actualProposalCount >= 3) {
        toast({ title: 'Building intelligence profile…', description: 'This may take a moment.' });
        const { data: built } = await supabase.functions.invoke('build-user-context', {
          body: { trade: '', job_description: '', job_address: '', target_user_id: u.userId },
        });
        if (built?.intelligence_profile) {
          row = { intelligence_profile: built.intelligence_profile, computed_stats: built.computed_stats, proposal_count_at_computation: built.proposal_count, updated_at: new Date().toISOString() };
        }
      }
      setIntelData(row);
    } catch {
      setIntelData(null);
    } finally {
      setIntelLoading(false);
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
                    <td className="px-4 py-2">
                      {u.actualProposalCount}
                      {u.plan !== 'Paid' && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({u.proposalsUsed}/{u.freeLimit} free used)
                        </span>
                      )}
                    </td>
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
                      <div className="flex gap-1">
                        {u.status !== 'Subscriber' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setGrantUser(u); setGrantCount(3); }}
                          >
                            Grant Proposals
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEmailDialog(u)}
                          title="Send Email"
                        >
                          <Mail className="h-4 w-4 mr-1" /> Send Email
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewIntelligence(u)}
                          title="View Intelligence"
                        >
                          <Brain className="h-4 w-4" />
                        </Button>
                      </div>
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

      {/* Intelligence Dialog */}
      <Dialog open={!!intelUser} onOpenChange={(open) => !open && setIntelUser(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Intelligence Profile — {intelUser?.email}
            </DialogTitle>
          </DialogHeader>
          {intelLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !intelData ? (
            <p className="text-sm text-muted-foreground py-4">No intelligence data available for this user. They may have fewer than 3 proposals.</p>
          ) : (
            <div className="space-y-4 text-sm">
              {/* Meta */}
              <div className="flex gap-4 flex-wrap text-xs text-muted-foreground">
                <span>Proposals at computation: <strong className="text-foreground">{intelData.proposal_count_at_computation}</strong></span>
                <span>Updated: {new Date(intelData.updated_at).toLocaleString()}</span>
              </div>

              {intelData.intelligence_profile ? (
                <>
                  {/* Pricing personality */}
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline">
                      Pricing: {intelData.intelligence_profile.pricing_personality?.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="outline">
                      Confidence: {intelData.intelligence_profile.pricing_confidence}
                    </Badge>
                  </div>

                  {/* Contractor Insights */}
                  {intelData.intelligence_profile.contractor_insights?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Contractor Insights</h4>
                      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                        {intelData.intelligence_profile.contractor_insights.map((insight: string, i: number) => (
                          <li key={i}>{insight}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Pricing Benchmarks */}
                  {intelData.intelligence_profile.pricing_benchmarks?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Pricing Benchmarks</h4>
                      <div className="border rounded overflow-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left px-3 py-1.5">Line Item</th>
                              <th className="text-left px-3 py-1.5">Learned Price</th>
                              <th className="text-left px-3 py-1.5">Unit</th>
                              <th className="text-left px-3 py-1.5">Based On</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {intelData.intelligence_profile.pricing_benchmarks.map((b: any, i: number) => (
                              <tr key={i}>
                                <td className="px-3 py-1.5">{b.line_item_type}</td>
                                <td className="px-3 py-1.5">${b.learned_unit_price?.toFixed(2)}</td>
                                <td className="px-3 py-1.5">{b.learned_unit}</td>
                                <td className="px-3 py-1.5">{b.based_on_n_proposals} proposals</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Anomaly Flags */}
                  {intelData.intelligence_profile.anomaly_flags?.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Anomaly Flags</h4>
                      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                        {intelData.intelligence_profile.anomaly_flags.map((flag: string, i: number) => (
                          <li key={i}>{flag}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">AI synthesis not available. Raw stats only.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Email Dialog */}
      <Dialog open={!!emailUser} onOpenChange={(open) => !open && setEmailUser(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Send Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-sm">To</Label>
              <Input value={emailUser?.email || ''} readOnly className="mt-1 bg-muted" />
            </div>
            <div>
              <Label className="text-sm">Use Template</Label>
              <Select value={emailTemplate} onValueChange={applyTemplate}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a pre-made template…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free_credits">Free Credits + Demo Offer</SelectItem>
                  <SelectItem value="check_in">Just Checking In</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">Subject</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">Body</Label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={12}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">Sent from brett@ezbid.pro via Resend.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEmailUser(null)} disabled={sendingEmail}>Cancel</Button>
              <Button onClick={handleSendEmail} disabled={sendingEmail}>
                {sendingEmail ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending…</> : 'Send'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
