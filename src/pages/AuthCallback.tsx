import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [message, setMessage] = useState('Verifying your account...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const queryParams = url.searchParams;

        const errorDesc =
          hashParams.get('error_description') || queryParams.get('error_description');
        if (errorDesc) {
          toast({ title: 'Verification failed', description: errorDesc, variant: 'destructive' });
          navigate('/auth', { replace: true });
          return;
        }

        // PKCE / OAuth code flow
        const code = queryParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        }

        // Implicit / email-link tokens in hash (access_token + refresh_token)
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        // OTP-style verification (?token_hash=...&type=...)
        const tokenHash = queryParams.get('token_hash');
        const type = queryParams.get('type');
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (error) throw error;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          toast({ title: 'Email verified', description: 'Welcome to EZ-Bid!' });
          navigate('/dashboard', { replace: true });
        } else {
          setMessage('Verification complete. Please sign in.');
          navigate('/auth', { replace: true });
        }
      } catch (err: any) {
        toast({
          title: 'Verification error',
          description: err?.message || 'Could not verify your account.',
          variant: 'destructive',
        });
        navigate('/auth', { replace: true });
      }
    };
    handleCallback();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
