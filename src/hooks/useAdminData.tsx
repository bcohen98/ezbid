import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function fetchAdminSection(section: string, params?: Record<string, string>) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) return { __unauthorized: true };

  const qp = new URLSearchParams({ section, ...params });
  const url = `${supabaseUrl}/functions/v1/admin-data?${qp.toString()}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  if (res.status === 401 || res.status === 403) {
    return { __unauthorized: true };
  }
  if (!res.ok) throw new Error('Failed to fetch admin data');
  return await res.json();
}

export function useAdminCheck() {
  return useQuery({
    queryKey: ['admin-check'],
    queryFn: async () => {
      const data = await fetchAdminSection('check');
      return { is_admin: data?.is_admin === true };
    },
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

export function useAdminAnalytics(range: string = 'month') {
  return useQuery({
    queryKey: ['admin-analytics', range],
    queryFn: () => fetchAdminSection('analytics', { range }),
    staleTime: 60_000,
  });
}

export function useAdminVisitorAnalytics(range: string = '30') {
  return useQuery({
    queryKey: ['admin-visitor-analytics', range],
    queryFn: () => fetchAdminSection('visitor_analytics', { range }),
    staleTime: 60_000,
  });
}

export function useAdminReferrals() {
  return useQuery({
    queryKey: ['admin-referrals'],
    queryFn: () => fetchAdminSection('referrals'),
    staleTime: 30_000,
  });
}

export function useAdminConversions(range: string = '30') {
  return useQuery({
    queryKey: ['admin-conversions', range],
    queryFn: () => fetchAdminSection('conversions', { range }),
    staleTime: 30_000,
    refetchInterval: 30_000, // auto-refresh every 30s for live feel
  });
}
