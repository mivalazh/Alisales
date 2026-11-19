import { describe, expect, it } from 'vitest';
import {
  normalizeRoute,
  percentile,
  rateVital,
  sanitizeMonitorEvent,
  summarizeMonitorEvents,
  type MonitorEvent,
} from './events';

const NOW = Date.parse('2026-11-19T12:00:00.000Z');

function errorEvent(overrides: Record<string, unknown> = {}) {
  return sanitizeMonitorEvent(
    { kind: 'error', route: '/listing/x', message: 'boom', source: 'server', ...overrides },
    NOW,
  );
}

function mustSanitize(input: unknown): MonitorEvent {
  const event = sanitizeMonitorEvent(input, NOW);
  if (!event) throw new Error(`expected a stored event, got null for ${JSON.stringify(input)}`);
  return event;
}

describe('sanitizeMonitorEvent', () => {
  it('strips the query string and hash from a route', () => {
    const event = errorEvent({ route: '/listing/x?phone=09120000000#gallery' });
    expect(event?.route).toBe('/listing/x');
  });

  it('reduces an absolute URL to its path', () => {
    expect(normalizeRoute('https://alisales.example/support?token=abc')).toBe('/support');
    expect(normalizeRoute('not a url')).toBe('/');
  });

  it('clips a long message and removes control characters', () => {
    const event = errorEvent({ message: `a\nb${'x'.repeat(500)}` });
    expect(event?.kind).toBe('error');
    if (event?.kind !== 'error') throw new Error('expected an error event');
    expect(event.message.length).toBeLessThanOrEqual(300);
    expect(event.message).not.toContain('\n');
  });

  it('drops reports that carry no message or an unknown kind', () => {
    expect(errorEvent({ message: '' })).toBeNull();
    expect(errorEvent({ kind: 'pageview' })).toBeNull();
    expect(sanitizeMonitorEvent(null, NOW)).toBeNull();
    expect(sanitizeMonitorEvent('boom', NOW)).toBeNull();
  });

  it('keeps only a valid HTTP status', () => {
    const ok = errorEvent({ status: 503 });
    expect(ok?.kind === 'error' ? ok.status : undefined).toBe(503);
    const bad = errorEvent({ status: 99 });
    expect(bad?.kind === 'error' ? bad.status : undefined).toBeUndefined();
  });

  it('recomputes a vital rating from the value, ignoring the client claim', () => {
    const vital = sanitizeMonitorEvent(
      { kind: 'vital', metric: 'LCP', value: 6200, rating: 'good', route: '/', at: '2026-11-19T11:00:00.000Z' },
      NOW,
    );
    expect(vital?.kind).toBe('vital');
    if (vital?.kind !== 'vital') throw new Error('expected a vital event');
    expect(vital.rating).toBe('poor');
    expect(vital.value).toBe(6200);
  });

  it('rejects non-finite or negative metric values and unknown metric names', () => {
    expect(sanitizeMonitorEvent({ kind: 'vital', metric: 'LCP', value: -1 }, NOW)).toBeNull();
    expect(sanitizeMonitorEvent({ kind: 'vital', metric: 'LCP', value: 'slow' }, NOW)).toBeNull();
    expect(sanitizeMonitorEvent({ kind: 'vital', metric: 'FID', value: 12 }, NOW)).toBeNull();
  });

  it('replaces a clock-skewed timestamp with the server clock', () => {
    const event = sanitizeMonitorEvent(
      { kind: 'error', message: 'boom', at: '2001-01-01T00:00:00.000Z' },
      NOW,
    );
    expect(event?.at).toBe(new Date(NOW).toISOString());
  });
});

describe('rateVital / percentile', () => {
  it('uses the Core Web Vitals boundaries', () => {
    expect(rateVital('LCP', 2500)).toBe('good');
    expect(rateVital('LCP', 2501)).toBe('needs-improvement');
    expect(rateVital('LCP', 4001)).toBe('poor');
    expect(rateVital('CLS', 0.05)).toBe('good');
    expect(rateVital('INP', 600)).toBe('poor');
  });

  it('returns the nearest-rank percentile without mutating the input', () => {
    const values = [4000, 1000, 3000, 2000];
    expect(percentile(values, 0.75)).toBe(3000);
    expect(values).toEqual([4000, 1000, 3000, 2000]);
    expect(percentile([], 0.75)).toBe(0);
  });
});

describe('summarizeMonitorEvents', () => {
  const events: MonitorEvent[] = [
    ...Array.from({ length: 4 }, () =>
      mustSanitize({ kind: 'error', route: '/checkout', message: 'stripe timeout', source: 'server' }),
    ),
    mustSanitize({ kind: 'error', route: '/support', message: 'other failure', source: 'server' }),
    ...[1000, 2000, 3000, 9000].map((value) =>
      mustSanitize({
        kind: 'vital',
        metric: 'LCP',
        value,
        route: '/',
        at: new Date(NOW - 60_000).toISOString(),
      }),
    ),
    mustSanitize({
      kind: 'vital',
      metric: 'INP',
      value: 600,
      route: '/listing/x',
      at: new Date(NOW).toISOString(),
    }),
  ];

  it('collapses repeated failures and sorts them by count', () => {
    const summary = summarizeMonitorEvents(events, { now: NOW });
    expect(summary.errorCount).toBe(5);
    expect(summary.errors).toHaveLength(2);
    expect(summary.errors[0]?.message).toBe('stripe timeout');
    expect(summary.errors[0]?.count).toBe(4);
  });

  it('reports p75 per metric and per route', () => {
    const summary = summarizeMonitorEvents(events, { now: NOW });
    const lcp = summary.vitals.find((vital) => vital.metric === 'LCP');
    expect(lcp?.count).toBe(4);
    expect(lcp?.p75).toBe(3000);
    expect(lcp?.rating).toBe('needs-improvement');
    expect(lcp?.routes[0]?.route).toBe('/');
  });

  it('lists only non-good route/metric pairs, worst first', () => {
    const summary = summarizeMonitorEvents(events, { now: NOW });
    expect(summary.slowRoutes.map((row) => row.metric)).toEqual(['INP', 'LCP']);
    expect(summary.slowRoutes[0]?.rating).toBe('poor');
  });

  it('ignores reports outside the window', () => {
    const stale = sanitizeMonitorEvent(
      { kind: 'error', message: 'old', at: new Date(NOW - 48 * 60 * 60_000).toISOString() },
      NOW,
    )!;
    const summary = summarizeMonitorEvents([...events, stale], { now: NOW, windowHours: 24 });
    expect(summary.errorCount).toBe(5);
    expect(summary.totalEvents).toBe(events.length);
  });
});
