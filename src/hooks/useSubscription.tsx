import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const canCreateProposal = (() => {
    if (!query.data) return true; // Allow while loading — don't block
    if (query.data.status === 'active') return true;
    return query.data.proposals_used < 3;
  })();

  const incrementProposalCount = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not ready');
      const { error } = await (supabase.rpc as any)('increment_proposals_used', { p_user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
    },
  });

  return {
    subscription: query.data,
    isLoading: query.isLoading,
    canCreateProposal,
    incrementProposalCount: incrementProposalCount.mutateAsync,
  };
}
