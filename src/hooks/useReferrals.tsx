import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useReferralCode() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['referral-code', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Check for existing code
      const { data: existing } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) return existing.code;

      // Generate a new code from email prefix
      const prefix = (user.email?.split('@')[0] || 'USER').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8) || 'USER';
      
      for (let attempt = 0; attempt < 10; attempt++) {
        const num = Math.floor(Math.random() * 90 + 10);
        const code = `${prefix}${num}`;
        
        const { error } = await supabase
          .from('referral_codes')
          .insert({ user_id: user.id, code });

        if (!error) return code;
        // Retry on unique constraint violation
        if (error.code !== '23505') throw error;
      }
      throw new Error('Could not generate unique referral code');
    },
    enabled: !!user,
    staleTime: Infinity,
  });
}

export function useReferrals() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['referrals', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useReferralCredits() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['referral-credits', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referral_credits')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useSendReferralInvites() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emails: string[]) => {
      const { data, error } = await supabase.functions.invoke('send-referral-invite', {
        body: { emails },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
    },
  });
}
