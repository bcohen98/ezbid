import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

function getSessionId() {
  let sid = sessionStorage.getItem('ez_sid');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('ez_sid', sid);
  }
  return sid;
}

function getVisitorId() {
  let vid = localStorage.getItem('ez_vid');
  if (!vid) {
    vid = crypto.randomUUID();
    localStorage.setItem('ez_vid', vid);
  }
  return vid;
}

export function usePageTracking() {
  const location = useLocation();
  const lastPath = useRef('');
  const { user } = useAuth();

  useEffect(() => {
    const path = location.pathname;
    if (path === lastPath.current) return;
    lastPath.current = path;

    const sessionId = getSessionId();

    // Existing page_views insert (keep existing functionality)
    supabase
      .from('page_views')
      .insert({
        path,
        session_id: sessionId,
        user_agent: navigator.userAgent,
      })
      .then();

    // New site_analytics tracking via edge function
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    fetch(`${supabaseUrl}/functions/v1/log-visit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        page_url: path,
        session_id: sessionId,
        visitor_id: getVisitorId(),
        is_logged_in: !!user,
        user_id: user?.id || null,
      }),
    }).catch(() => {}); // fire-and-forget
  }, [location.pathname, user]);
}

/** Call this from guest proposal pages to track funnel events */
export function logGuestProposalEvent(type: 'start' | 'complete') {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  fetch(`${supabaseUrl}/functions/v1/log-visit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({
      page_url: type === 'start' ? '/guest/new-proposal' : '/guest/preview',
      session_id: sessionStorage.getItem('ez_sid') || '',
      visitor_id: localStorage.getItem('ez_vid') || '',
      is_logged_in: false,
      is_guest_proposal_start: type === 'start',
      is_guest_proposal_complete: type === 'complete',
    }),
  }).catch(() => {});
}
