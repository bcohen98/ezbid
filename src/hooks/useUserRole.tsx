import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useUserRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return { isAdmin: false, isAmbassador: false };
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      const roles = (data || []).map((r: any) => r.role);
      return { isAdmin: roles.includes('admin'), isAmbassador: roles.includes('ambassador') || roles.includes('admin') };
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}
