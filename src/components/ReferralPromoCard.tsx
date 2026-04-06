import { useState } from 'react';
import { useReferralCode } from '@/hooks/useReferrals';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, Mail, Gift, UserPlus, CreditCard, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ReferralPromoCardProps {
  dismissible?: boolean;
  onDismiss?: () => void;
  compact?: boolean;
}

export default function ReferralPromoCard({ dismissible = false, onDismiss, compact = false }: ReferralPromoCardProps) {
  const { data: code } = useReferralCode();
  const { toast } = useToast();
  const navigate = useNavigate();

  const referralUrl = code ? `https://ezbid-seven.vercel.app/auth?ref=${code}` : '';

  const copyLink = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    toast({ title: 'Link copied!', description: 'Share it with fellow contractors.' });
  };

  if (compact) {
    return (
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4">
        {dismissible && (
          <button onClick={onDismiss} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
        <Gift className="h-5 w-5 text-success shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Refer a contractor, earn a free month</p>
          <p className="text-xs text-muted-foreground">No cap on referrals.</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => navigate('/referrals')}>
          Refer & Earn <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg border bg-card p-5 md:p-6">
      {dismissible && (
        <button onClick={onDismiss} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="text-center mb-6">
        <h3 className="text-xl font-bold">Refer a contractor. Earn a free month.</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Every paid referral = 1 free month added to your account. No cap.
        </p>
      </div>

      {/* 3-step flow */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: UserPlus, label: 'Share link' },
          { icon: CreditCard, label: 'They subscribe' },
          { icon: Gift, label: 'You earn' },
        ].map((step, i) => (
          <div key={i} className="text-center">
            <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-full bg-success/10 text-success">
              <step.icon className="h-4 w-4" />
            </div>
            <p className="text-xs font-medium mt-2">{step.label}</p>
            {i < 2 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground absolute hidden" />
            )}
          </div>
        ))}
      </div>

      {/* Code display */}
      {code && (
        <div className="flex items-center justify-center gap-3 mb-4">
          <Badge variant="outline" className="text-base font-mono px-4 py-1.5">
            {code}
          </Badge>
        </div>
      )}

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
        <Button onClick={copyLink} className="gap-2 w-full sm:w-auto">
          <Copy className="h-4 w-4" />
          Copy My Link
        </Button>
        <Button variant="outline" onClick={() => navigate('/referrals')} className="gap-2 w-full sm:w-auto">
          <Mail className="h-4 w-4" />
          Invite by Email
        </Button>
      </div>
    </div>
  );
}
