import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import ReferralPromoCard from '@/components/ReferralPromoCard';
import { useReferralCode, useReferrals, useReferralCredits, useSendReferralInvites } from '@/hooks/useReferrals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Send, Gift, Users, CheckCircle, Clock } from 'lucide-react';

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  signed_up: { label: 'Signed Up', className: 'bg-primary/10 text-primary' },
  converted: { label: 'Converted', className: 'bg-success/10 text-success' },
};

export default function ReferAndEarn() {
  const { data: code } = useReferralCode();
  const { data: referrals, isLoading: referralsLoading } = useReferrals();
  const { data: credits } = useReferralCredits();
  const sendInvites = useSendReferralInvites();
  const { toast } = useToast();
  const [emailInput, setEmailInput] = useState('');

  const referralUrl = code ? `https://ezbid-seven.vercel.app/auth?ref=${code}` : '';

  const copyLink = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    toast({ title: 'Link copied!' });
  };

  const handleSendInvites = async () => {
    const emails = emailInput.split(',').map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) {
      toast({ title: 'Enter at least one email', variant: 'destructive' });
      return;
    }
    try {
      await sendInvites.mutateAsync(emails);
      toast({ title: 'Invites sent!', description: `Sent ${emails.length} invitation${emails.length > 1 ? 's' : ''}.` });
      setEmailInput('');
    } catch (err: any) {
      toast({ title: 'Error sending invites', description: err.message, variant: 'destructive' });
    }
  };

  const totalReferrals = referrals?.length || 0;
  const converted = referrals?.filter(r => r.status === 'converted').length || 0;
  const totalCredits = credits?.length || 0;
  const unusedCredits = credits?.filter(c => !c.applied_at).length || 0;

  return (
    <AppLayout>
      <div className="container px-4 py-6 md:py-8 space-y-6 animate-fade-in max-w-4xl">
        <ReferralPromoCard />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{totalReferrals}</p>
              <p className="text-xs text-muted-foreground">Total Referrals</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <CheckCircle className="h-5 w-5 mx-auto text-success mb-1" />
              <p className="text-2xl font-bold">{converted}</p>
              <p className="text-xs text-muted-foreground">Converted</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Gift className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{totalCredits}</p>
              <p className="text-xs text-muted-foreground">Months Earned</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <Clock className="h-5 w-5 mx-auto text-warning mb-1" />
              <p className="text-2xl font-bold">{unusedCredits}</p>
              <p className="text-xs text-muted-foreground">Months Remaining</p>
            </CardContent>
          </Card>
        </div>

        {/* Copy link section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Referral Link</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input readOnly value={referralUrl} className="font-mono text-sm" />
              <Button onClick={copyLink} className="gap-2 shrink-0">
                <Copy className="h-4 w-4" /> Copy
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invite by email */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Invite by Email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Enter email addresses separated by commas. We'll send them a branded invite with your referral link.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="email1@example.com, email2@example.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="text-sm"
              />
              <Button
                onClick={handleSendInvites}
                disabled={sendInvites.isPending}
                className="gap-2 shrink-0"
              >
                <Send className="h-4 w-4" />
                {sendInvites.isPending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Referrals table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {referralsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : !referrals || referrals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No referrals yet. Share your link to get started!</p>
            ) : (
              <div className="border rounded-lg divide-y">
                {referrals.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{r.referred_email}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={statusConfig[r.status]?.className || ''}
                      >
                        {statusConfig[r.status]?.label || r.status}
                      </Badge>
                      {r.credit_applied && (
                        <Badge variant="outline" className="bg-success/10 text-success">
                          Credit applied
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
