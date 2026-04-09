/**
 * Dual-track events: GA4 + own conversion_events table.
 */
import { gtagEvent } from '@/lib/gtag';
import { supabase } from '@/integrations/supabase/client';

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | null>,
) {
  // 1. Fire GA4 event
  gtagEvent(eventName, params);

  // 2. Insert into our own conversion_events table (fire-and-forget)
  const sessionId = sessionStorage.getItem('ez_sid') || null;
  const visitorId = localStorage.getItem('ez_vid') || null;

  supabase
    .from('conversion_events')
    .insert({
      event_name: eventName,
      session_id: sessionId,
      visitor_id: visitorId,
      metadata: params ?? {},
      page_path: window.location.pathname,
    })
    .then(() => {}, () => {});
}
