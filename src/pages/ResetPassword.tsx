import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import EZBidLogo from '@/components/EZBidLogo';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const query = new URLSearchParams(window.location.search);

        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');
        const code = query.get('code');
        const token_hash = query.get('token_hash');
        const type = query.get('type') || hashParams.get('type');

        if (code) {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        } else if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        } else if (token_hash && type) {
          await supabase.auth.verifyOtp({ token_hash, type: type as any });
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast({ title: 'Invalid or expired link', description: 'Please request a new password reset.', variant: 'destructive' });
          navigate('/auth', { replace: true });
          return;
        }
        setReady(true);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
        navigate('/auth', { replace: true });
      }
    })();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Password too short', description: 'Must be at least 8 characters.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password updated', description: 'You are now signed in.' });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Verifying reset link…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <EZBidLogo size="lg" className="justify-center" />
          <p className="mt-2 text-sm text-muted-foreground">Set a new password</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
