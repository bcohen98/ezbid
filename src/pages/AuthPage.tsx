import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import EZBidLogo from '@/components/EZBidLogo';
import heroBg from '@/assets/hero-bg.jpg';
import { supabase } from '@/integrations/supabase/client';

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Capture referral code from URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('ezbid_referral_code', ref);
      setIsSignUp(true); // Default to signup when arriving via referral
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) throw error;

        // Link referral after signup
        const refCode = localStorage.getItem('ezbid_referral_code');
        if (refCode) {
          try {
            await supabase.functions.invoke('link-referral', {
              body: { email, referralCode: refCode },
            });
          } catch {
            // Non-blocking — referral linking can fail silently
          }
          localStorage.removeItem('ezbid_referral_code');
        }

        toast({ title: 'Account created!', description: 'Check your email to confirm your account. If you don\'t see it, check your spam or junk folder.' });
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 relative overflow-hidden">
      {/* Background image with opacity overlay — only affects the photo */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="absolute inset-0 bg-background/90" />

      {/* Logo — sits above the overlay, fully opaque */}
      <div className="absolute top-4 left-4 z-10">
        <Link to="/">
          <EZBidLogo size="md" />
        </Link>
      </div>

      {/* Form — sits above the overlay, fully opaque */}
      <div className="min-h-screen flex items-center justify-center relative z-10">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 text-center">
            <EZBidLogo size="lg" className="justify-center" />
            <p className="mt-2 text-sm text-muted-foreground">
              {isSignUp ? 'Create your account' : 'Sign in to your account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              {isSignUp && (
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters and include uppercase, lowercase, a number, and a special character.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : isSignUp ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-foreground underline underline-offset-4 hover:text-foreground/80"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
