import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const IGNORED_ERRORS = [
  'Object Not Found Matching Id',
  'MethodName:update, ParamCount:4',
];

function isIgnoredError(msg: string): boolean {
  return IGNORED_ERRORS.some(pattern => msg.includes(pattern));
}

export function useErrorTracking() {
  useEffect(() => {
    async function logError(error_message: string, error_stack: string | null) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      supabase
        .from('app_errors')
        .insert({
          error_message: error_message.slice(0, 2000),
          error_stack: error_stack ? error_stack.slice(0, 10000) : null,
          path: window.location.pathname,
        })
        .then(() => {}, () => {});
    }

    function handleError(event: ErrorEvent) {
      const msg = event.message || 'Unknown error';
      if (isIgnoredError(msg)) return;
      logError(msg, event.error?.stack || null);
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const msg =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason);
      if (isIgnoredError(msg)) return;
      logError(
        msg,
        event.reason instanceof Error ? event.reason.stack || null : null,
      );
    }

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
}
