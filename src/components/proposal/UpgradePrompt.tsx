import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { gtagEvent } from '@/lib/gtag';

interface Props {
  proposalsUsed: number;
  onContinue: () => void;
  source?: string;
}

export default function UpgradePrompt({ proposalsUsed, onContinue, source }: Props) {
  const [loading, setLoading] = useState<'monthly' | 'annual' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    gtagEvent('free_limit_reached', { proposals_used: proposalsUsed });
    gtagEvent('upgrade_prompt_viewed', { source: source || 'unknown' });
  }, []);

  const handleUpgrade = async (plan: 'monthly' | 'annual') => {
    setLoading(plan);
    try {
      const { data, error } = await supabase.functions.invoke('create-pro-checkout', {
        body: { plan },
      });
      if (error) throw error;
      if (data?.url) {
        gtagEvent('subscription_upgraded', { plan });
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Could not start checkout', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container max-w-lg px-4 py-12 md:py-16 animate-fade-in">
      <Card>
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">You've used all 3 free proposals</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Upgrade to unlimited proposals. Cancel anytime.
          </p>
          <div className="space-y-3">
            <Button className="w-full gap-2" onClick={() => handleUpgrade('monthly')} disabled={!!loading}>
              {loading === 'monthly' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Pro Monthly · $29/mo <ArrowRight className="h-4 w-4" /></>}
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={() => handleUpgrade('annual')} disabled={!!loading}>
              {loading === 'annual' ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Pro Annual · $290/yr (2 months free) <ArrowRight className="h-4 w-4" /></>}
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onContinue}>
              Maybe later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
