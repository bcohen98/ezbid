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
    async function logError(payload: { error_message: string; error_stack: string | null; path: string }) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return; // only authenticated users log errors
      supabase.from('app_errors').insert(payload).then(() => {}, () => {});
    }

    function handleError(event: ErrorEvent) {
      const msg = event.message || 'Unknown error';
      if (isIgnoredError(msg)) return;
      logError({
        error_message: msg.slice(0, 2000),
        error_stack: event.error?.stack?.slice(0, 10000) || null,
        path: window.location.pathname,
      });
    }
    // legacy unused branch removed below
    const _unused = () => supabase
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
