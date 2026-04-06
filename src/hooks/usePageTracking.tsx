import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

function getSessionId() {
  let sid = sessionStorage.getItem('ez_sid');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('ez_sid', sid);
  }
  return sid;
}

export function usePageTracking() {
  const location = useLocation();
  const lastPath = useRef('');

  useEffect(() => {
    const path = location.pathname;
    if (path === lastPath.current) return;
    lastPath.current = path;

    supabase
      .from('page_views')
      .insert({
        path,
        session_id: getSessionId(),
        user_agent: navigator.userAgent,
      })
      .then(); // fire-and-forget
  }, [location.pathname]);
}
