import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useErrorTracking() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      supabase
        .from('app_errors')
        .insert({
          error_message: event.message || 'Unknown error',
          error_stack: event.error?.stack?.slice(0, 2000) || null,
          path: window.location.pathname,
        })
        .then();
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const msg =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason);
      supabase
        .from('app_errors')
        .insert({
          error_message: msg.slice(0, 500),
          error_stack:
            event.reason instanceof Error
              ? event.reason.stack?.slice(0, 2000)
              : null,
          path: window.location.pathname,
        })
        .then();
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
}
