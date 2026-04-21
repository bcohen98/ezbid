import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function PricingSection() {
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [validCode, setValidCode] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const stored = localStorage.getItem('ambassador_promo_code');
    if (stored) {
      setCode(stored);
      validate(stored, true);
    }
  }, []);

  const validate = async (input: string, silent = false) => {
    const trimmed = input.trim().toUpperCase();
    if (!trimmed) return;
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-ambassador-code', {
        body: { code: trimmed },
      });
      if (error) throw error;
      if (data?.valid) {
        setValidCode(trimmed);
        localStorage.setItem('ambassador_promo_code', trimmed);
        if (!silent) toast({ title: 'Promo code applied!', description: 'You get $7/mo or $70/yr off your first year.' });
      } else {
        setValidCode(null);
        localStorage.removeItem('ambassador_promo_code');
        if (!silent) toast({ title: 'Invalid code', description: data?.reason || 'Code not found or expired', variant: 'destructive' });
      }
    } catch (e: any) {
      if (!silent) toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };

  const monthly = validCode ? 29 : 36;
  const annual = validCode ? 290 : 360;

  return (
    <section className="py-12 md:py-16">
      <div className="container max-w-4xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-center">Simple, honest pricing</h2>
        <p className="mt-2 text-center text-muted-foreground">Start free. Upgrade when you're winning enough jobs to justify it.</p>

        {/* Promo code input */}
        <div className="mt-6 max-w-md mx-auto">
          <div className="flex gap-2">
            <Input
              placeholder="Have a promo code?"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && validate(code)}
              className="text-center"
            />
            <Button onClick={() => validate(code)} disabled={validating || !code} variant="outline">
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
          {validCode && (
            <p className="text-xs text-center text-foreground mt-2 flex items-center justify-center gap-1">
              <Check className="h-3 w-3" /> Code <strong>{validCode}</strong> applied — saves $7/mo or $70/yr
            </p>
          )}
        </div>

        <div className="mt-8 md:mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 max-w-4xl mx-auto">
          {/* Free */}
          <div className="rounded-lg border bg-card p-5 md:p-6">
            <h3 className="text-lg font-semibold">Free</h3>
            <p className="mt-1 text-3xl font-bold">$0</p>
            <p className="text-xs text-muted-foreground">3 proposals, no credit card</p>
            <ul className="mt-5 space-y-2">
              {["3 professional proposals", "All 10 templates", "AI-written scope & terms", "PDF export", "E-signatures"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/guest/new-proposal" className="block mt-6">
              <Button variant="outline" className="w-full">Create My First Proposal — Free</Button>
            </Link>
          </div>

          {/* Pro Monthly */}
          <div className="rounded-lg border-2 border-foreground bg-card p-5 md:p-6 relative">
            <span className="absolute -top-3 left-4 bg-foreground text-background text-xs font-medium px-2.5 py-0.5 rounded-full">
              Most popular
            </span>
            <h3 className="text-lg font-semibold">Pro Monthly</h3>
            <p className="mt-1 text-3xl font-bold">
              {validCode && <span className="text-xl text-muted-foreground line-through mr-2">$36</span>}
              ${monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
            <p className="text-xs text-muted-foreground">Unlimited proposals</p>
            <ul className="mt-5 space-y-2">
              {["Unlimited proposals", "All 10 templates", "AI-written scope & terms", "PDF export", "E-signatures", "Email delivery to clients", "Priority support"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/auth" className="block mt-6">
              <Button className="w-full">Start free trial</Button>
            </Link>
          </div>

          {/* Pro Annual */}
          <div className="rounded-lg border bg-card p-5 md:p-6 relative">
            <span className="absolute -top-3 left-4 bg-primary text-primary-foreground text-xs font-medium px-2.5 py-0.5 rounded-full">
              Best value
            </span>
            <h3 className="text-lg font-semibold">Pro Annual</h3>
            <p className="mt-1 text-3xl font-bold">
              {validCode && <span className="text-xl text-muted-foreground line-through mr-2">$360</span>}
              ${annual}<span className="text-sm font-normal text-muted-foreground">/yr</span>
            </p>
            <p className="text-xs text-muted-foreground">~${Math.round(annual/12)}/mo · Unlimited proposals</p>
            <ul className="mt-5 space-y-2">
              {["Everything in Pro Monthly", "Locked-in pricing", "Priority support"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-foreground shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            <Link to="/auth" className="block mt-6">
              <Button className="w-full">Start free trial</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
