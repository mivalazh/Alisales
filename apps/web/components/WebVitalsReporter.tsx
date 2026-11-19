'use client';

import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { useEffect, useRef } from 'react';
import { sendMonitorEvents, type ClientMonitorEvent } from '@/lib/monitoring/client';

/**
 * Field Web Vitals → `/api/monitor`.
 *
 * Metrics arrive one by one while the page is still settling, so they are
 * batched: flush when the tab is hidden or unloaded (the most reliable moment),
 * after five metrics, or after a short idle delay. One request per visit
 * instead of five keeps this genuinely lightweight on a mobile connection.
 *
 * Sampling defaults to every visit and can be lowered with
 * `NEXT_PUBLIC_VITALS_SAMPLE_RATE` (0–1) once traffic is high enough that a
 * sample is enough.
 */

const FLUSH_DELAY_MS = 6_000;
const MAX_BATCH = 5;
const MAX_REPORTS_PER_VISIT = 20;

function sampleRate(): number {
  const raw = Number(process.env.NEXT_PUBLIC_VITALS_SAMPLE_RATE);
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 1;
}

export function WebVitalsReporter() {
  const pathname = usePathname();
  // Read at report time: a metric can land after a client-side navigation.
  const route = useRef(pathname || '/');
  route.current = pathname || '/';

  const enabled = useRef<boolean | null>(null);
  if (enabled.current === null) enabled.current = Math.random() < sampleRate();

  const queue = useRef<ClientMonitorEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sent = useRef(0);

  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (queue.current.length === 0) return;
    const batch = queue.current;
    queue.current = [];
    sendMonitorEvents(batch);
  };

  useEffect(() => {
    // `pagehide` covers navigation and tab close; `visibilitychange` covers the
    // mobile case where the app is backgrounded and never unloaded.
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
      flush();
    };
    // `flush` only touches refs, so the first render's closure stays correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useReportWebVitals((metric) => {
    if (!enabled.current || sent.current >= MAX_REPORTS_PER_VISIT) return;
    sent.current += 1;

    queue.current.push({
      kind: 'vital',
      route: route.current,
      metric: metric.name,
      value: metric.value,
      rating: (metric as { rating?: string }).rating,
      navigationType: (metric as { navigationType?: string }).navigationType,
      at: new Date().toISOString(),
    });

    if (queue.current.length >= MAX_BATCH) {
      flush();
      return;
    }
    if (!timer.current) timer.current = setTimeout(flush, FLUSH_DELAY_MS);
  });

  return null;
}
