import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Loader2, Crown } from 'lucide-react';

interface Props {
  subscription: any;
  isActive: boolean;
}

export default function SubscriptionCard({ subscription, isActive }: Props) {
  const [loading, setLoading] = useState<'monthly' | 'annual' | 'portal' | null>(null);
  const { toast } = useToast();

  const plan = subscription?.plan; // 'starter' | 'pro'

  const handleCheckout = async (planType: 'monthly' | 'annual') => {
    setLoading(planType);
    try {
      const promo_code = localStorage.getItem('ambassador_promo_code') || undefined;
      const { data, error } = await supabase.functions.invoke('create-pro-checkout', {
        body: { plan: planType, promo_code },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
      else throw new Error('No checkout URL');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Could not start checkout', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    setLoading('portal');
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
      else throw new Error('No portal URL');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Could not open portal', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  // Active Pro subscriber
  if (isActive) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <Badge variant="default">Pro · Active</Badge>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handlePortal} disabled={!!loading}>
            {loading === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Manage subscription'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Free tier — show upgrade options
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Subscription</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Badge variant="secondary">Free tier</Badge>
        <p className="text-xs text-muted-foreground">Upgrade for unlimited proposals</p>
        <div className="space-y-2">
          <Button size="sm" className="w-full gap-2" onClick={() => handleCheckout('monthly')} disabled={!!loading}>
            {loading === 'monthly' ? <Loader2 className="h-3 w-3 animate-spin" /> : <>Pro · $36/mo <ArrowRight className="h-3 w-3" /></>}
          </Button>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => handleCheckout('annual')} disabled={!!loading}>
            {loading === 'annual' ? <Loader2 className="h-3 w-3 animate-spin" /> : <>Pro · $360/yr <ArrowRight className="h-3 w-3" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
