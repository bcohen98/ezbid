import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

async function fetchAdminSection(section: string, params?: Record<string, string>) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) throw new Error('Not authenticated');

  const qp = new URLSearchParams({ section, ...params });
  const url = `${supabaseUrl}/functions/v1/admin-data?${qp.toString()}`;
  console.log('[AdminCheck] Fetching:', url, '| section:', section);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });

  console.log('[AdminCheck] Response status:', res.status);

  if (res.status === 403) throw new Error('Not admin');
  if (!res.ok) throw new Error('Failed to fetch admin data');
  const data = await res.json();
  console.log('[AdminCheck] Response data:', data);
  return data;
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
