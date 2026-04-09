import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Known internal errors from Supabase JS client that are not actionable
const IGNORED_ERRORS = [
  'Object Not Found Matching Id',
  'MethodName:update, ParamCount:4',
];

function isIgnoredError(msg: string): boolean {
  return IGNORED_ERRORS.some(pattern => msg.includes(pattern));
}

export function useErrorTracking() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      const msg = event.message || 'Unknown error';
      if (isIgnoredError(msg)) return;
      supabase
        .from('app_errors')
        .insert({
          error_message: msg,
          error_stack: event.error?.stack?.slice(0, 2000) || null,
          path: window.location.pathname,
        })
        .then(() => {}, () => {});
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const msg =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason);
      if (isIgnoredError(msg)) return;
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
        .then(() => {}, () => {});
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
}
