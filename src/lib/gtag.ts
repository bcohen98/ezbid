/**
 * Google Analytics 4 helper — wraps the global gtag() function.
 * The GA4 snippet is loaded in index.html using VITE_GA_MEASUREMENT_ID.
 */

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

function gtag(...args: any[]) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args);
  }
}

/** Send a virtual pageview (for SPA route changes) */
export function gtagPageView(path: string) {
  if (!GA_ID) return;
  gtag('config', GA_ID, { page_path: path });
}

/** Fire a custom GA4 event */
export function gtagEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | null>,
) {
  if (!GA_ID) return;
  gtag('event', eventName, params ?? {});
}
