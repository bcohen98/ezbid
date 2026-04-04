import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ProposalExhibit {
  id: string;
  proposal_id: string;
  file_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export function useProposalExhibits(proposalId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['proposal-exhibits', proposalId],
    queryFn: async () => {
      if (!proposalId) return [];
      const { data, error } = await supabase
        .from('proposal_exhibits')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('sort_order');
      if (error) throw error;
      return data as ProposalExhibit[];
    },
    enabled: !!proposalId,
  });

  const addExhibit = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption?: string }) => {
      if (!proposalId || !user) throw new Error('Not authenticated');

      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${proposalId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('proposal-exhibits')
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('proposal-exhibits')
        .getPublicUrl(path);

      const currentCount = query.data?.length ?? 0;

      const { data, error } = await supabase
        .from('proposal_exhibits')
        .insert({
          proposal_id: proposalId,
          file_url: urlData.publicUrl,
          caption: caption || null,
          sort_order: currentCount,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProposalExhibit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-exhibits', proposalId] });
    },
  });

  const updateCaption = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) => {
      const { error } = await supabase
        .from('proposal_exhibits')
        .update({ caption })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-exhibits', proposalId] });
    },
  });

  const removeExhibit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('proposal_exhibits')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-exhibits', proposalId] });
    },
  });

  return {
    exhibits: query.data ?? [],
    isLoading: query.isLoading,
    addExhibit: addExhibit.mutateAsync,
    isAdding: addExhibit.isPending,
    updateCaption: updateCaption.mutateAsync,
    removeExhibit: removeExhibit.mutateAsync,
  };
}
