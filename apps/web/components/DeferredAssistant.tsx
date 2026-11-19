'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

/** Keep the chat widget out of the initial bundle and off the server render. */
const AIAssistantWidget = dynamic(
  () => import('./AIAssistantWidget').then((module) => module.AIAssistantWidget),
  { ssr: false },
);

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * Mount the assistant after the page has settled.
 *
 * The dynamic import already keeps its JS out of the initial bundle; this also
 * keeps its mounting work off the first paint, so hydration of the catalogue
 * and the header is never competing with an orb, a greeting bubble or its
 * dismissal state. The fallback timer covers browsers without
 * `requestIdleCallback`.
 */
export function DeferredAssistant() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (!cancelled) setReady(true);
    };
    const idle = window as IdleWindow;

    if (typeof idle.requestIdleCallback === 'function') {
      const handle = idle.requestIdleCallback(mount, { timeout: 2_000 });
      return () => {
        cancelled = true;
        idle.cancelIdleCallback?.(handle);
      };
    }

    const timer = window.setTimeout(mount, 1_200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return ready ? <AIAssistantWidget /> : null;
}
