import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

type CompanyProfile = Database['public']['Tables']['company_profiles']['Row'];
type CompanyProfileUpdate = Database['public']['Tables']['company_profiles']['Update'];

export function useCompanyProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['company-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data as CompanyProfile;
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: CompanyProfileUpdate) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('company_profiles')
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile', user?.id] });
    },
  });

  const profileCompletion = (() => {
    if (!query.data) return 0;
    const p = query.data;
    const fields = [p.company_name, p.owner_name, p.trade_type, p.phone, p.email, p.street_address, p.city, p.state, p.zip];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  })();

  return {
    profile: query.data,
    isLoading: query.isLoading,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    profileCompletion,
  };
}
