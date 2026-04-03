import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function fetchAdminSection(section: string) {
  const { data, error } = await supabase.functions.invoke('admin-data', {
    body: null,
    headers: {},
  });

  // Use query params approach
  const { data: result, error: fnError } = await supabase.functions.invoke(
    `admin-data?section=${section}`,
    { method: 'GET' }
  );

  if (fnError) throw new Error(fnError.message || 'Failed to fetch admin data');
  return result;
}

export function useAdminCheck() {
  return useQuery({
    queryKey: ['admin-check'],
    queryFn: () => fetchAdminSection('check'),
    retry: false,
    staleTime: 60_000,
  });
}

export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => fetchAdminSection('overview'),
    staleTime: 30_000,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: () => fetchAdminSection('users'),
    staleTime: 30_000,
  });
}

export function useAdminProposals() {
  return useQuery({
    queryKey: ['admin-proposals'],
    queryFn: () => fetchAdminSection('proposals'),
    staleTime: 30_000,
  });
}

export function useAdminRevenue() {
  return useQuery({
    queryKey: ['admin-revenue'],
    queryFn: () => fetchAdminSection('revenue'),
    staleTime: 30_000,
  });
}
