import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

type Proposal = Database['public']['Tables']['proposals']['Row'];
type ProposalInsert = Database['public']['Tables']['proposals']['Insert'];
type ProposalUpdate = Database['public']['Tables']['proposals']['Update'];
type LineItem = Database['public']['Tables']['proposal_line_items']['Row'];
type LineItemInsert = Database['public']['Tables']['proposal_line_items']['Insert'];

export function useProposals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['proposals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Proposal[];
    },
    enabled: !!user,
  });

  const createProposal = useMutation({
    mutationFn: async (proposal: Omit<ProposalInsert, 'user_id' | 'proposal_number'>) => {
      if (!user) throw new Error('Not authenticated');
      
      // Get next proposal number
      const { data: numData, error: numError } = await supabase.rpc('get_next_proposal_number', { p_user_id: user.id });
      if (numError) throw numError;
      
      const { data, error } = await supabase
        .from('proposals')
        .insert({ ...proposal, user_id: user.id, proposal_number: numData as number })
        .select()
        .single();
      if (error) throw error;
      return data as Proposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', user?.id] });
    },
  });

  const updateProposal = useMutation({
    mutationFn: async ({ id, ...updates }: ProposalUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('proposals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Proposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals', user?.id] });
    },
  });

  return {
    proposals: query.data ?? [],
    isLoading: query.isLoading,
    createProposal: createProposal.mutateAsync,
    updateProposal: updateProposal.mutateAsync,
    isCreating: createProposal.isPending,
  };
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: ['proposal', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Proposal;
    },
    enabled: !!id,
  });
}

export function useProposalLineItems(proposalId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['line-items', proposalId],
    queryFn: async () => {
      if (!proposalId) return [];
      const { data, error } = await supabase
        .from('proposal_line_items')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('sort_order');
      if (error) throw error;
      return data as LineItem[];
    },
    enabled: !!proposalId,
  });

  const upsertItems = useMutation({
    mutationFn: async (items: LineItemInsert[]) => {
      if (!proposalId) throw new Error('No proposal');
      // Delete existing items first
      await supabase.from('proposal_line_items').delete().eq('proposal_id', proposalId);
      if (items.length > 0) {
        const { error } = await supabase.from('proposal_line_items').insert(items);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['line-items', proposalId] });
    },
  });

  return {
    lineItems: query.data ?? [],
    isLoading: query.isLoading,
    upsertItems: upsertItems.mutateAsync,
  };
}
