/**
 * Monitoring event contract: what the browser and the server are allowed to
 * report, and how those reports are summarised for a human.
 *
 * Everything here is pure. The route handler only calls `sanitizeMonitorEvent`
 * (untrusted JSON in, a bounded record out) and the admin page only calls
 * `summarizeMonitorEvents` (records in, p75s and grouped errors out), so the
 * rules that decide "is this page slow?" live in one place and are testable
 * without a browser, a server or a network.
 *
 * Privacy: a report carries a route path, a clipped message, an optional
 * digest and a metric value. It never carries a query string, a phone number,
 * a cookie, a user id or a request body — `normalizeRoute` strips the query
 * before anything is stored.
 */

/** Default reporting window for the summary and the admin page. */
export const MONITOR_WINDOW_HOURS = 24;

/** How many events the store keeps (newest win). */
export const MONITOR_MAX_EVENTS = 500;

export const MAX_MESSAGE_LENGTH = 300;
export const MAX_ROUTE_LENGTH = 120;
export const MAX_DIGEST_LENGTH = 80;

export type VitalName = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';

export const VITAL_NAMES: readonly VitalName[] = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];

export type VitalRating = 'good' | 'needs-improvement' | 'poor';

export interface ErrorMonitorEvent {
  kind: 'error';
  id: string;
  /** ISO timestamp, clamped to a sane window by the sanitiser. */
  at: string;
  route: string;
  source: 'client' | 'server' | 'boundary';
  message: string;
  digest?: string;
  /** HTTP status for a server-side failure, when there is one. */
  status?: number;
}

export interface VitalMonitorEvent {
  kind: 'vital';
  id: string;
  at: string;
  route: string;
  metric: VitalName;
  value: number;
  /** Derived from `value` here, never trusted from the client. */
  rating: VitalRating;
  navigationType?: string;
}

export type MonitorEvent = ErrorMonitorEvent | VitalMonitorEvent;

/**
 * Core Web Vitals thresholds (the "good" and "poor" boundaries Google uses).
 * CLS is unitless; everything else is milliseconds.
 */
const VITAL_LIMITS: Record<VitalName, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

export function isVitalName(value: unknown): value is VitalName {
  return typeof value === 'string' && (VITAL_NAMES as readonly string[]).includes(value);
}

/** Rating for one measurement against the metric's own thresholds. */
export function rateVital(metric: VitalName, value: number): VitalRating {
  const { good, poor } = VITAL_LIMITS[metric];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]+/g;

/** One trimmed, single-line, length-capped string. */
function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS, ' ').trim().slice(0, max);
}

/**
 * A path we are willing to store: no origin, no query string, no hash, no
 * fragment of a secret. An absolute URL is reduced to its pathname.
 */
export function normalizeRoute(raw: unknown): string {
  if (typeof raw !== 'string') return '/';
  let path = raw.trim();
  if (!path) return '/';
  if (!path.startsWith('/')) {
    try {
      path = new URL(path).pathname;
    } catch {
      return '/';
    }
  }
  path = (path.split('#')[0] ?? '').split('?')[0] ?? '';
  if (!path.startsWith('/')) path = `/${path}`;
  return path.slice(0, MAX_ROUTE_LENGTH) || '/';
}

/**
 * A timestamp the client claims. Anything unparseable or more than a week away
 * from the server clock is replaced with "now": clock-skewed devices must not
 * be able to push a page into (or out of) the reporting window.
 */
function timestamp(raw: unknown, now: number): string {
  const parsed = typeof raw === 'string' ? Date.parse(raw) : Number.NaN;
  const plausible = Number.isFinite(parsed) && Math.abs(now - parsed) <= 7 * 24 * 60 * 60_000;
  return new Date(plausible ? parsed : now).toISOString();
}

function eventId(raw: unknown): string {
  if (typeof raw === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(raw)) return raw;
  return (
    globalThis.crypto?.randomUUID?.() ??
    `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
}

/**
 * Untrusted report → stored record, or null when it is not a report at all.
 *
 * Unknown keys are dropped, strings are clipped, and the vitals rating is
 * recomputed from the value so a client cannot label a 9s LCP as "good".
 */
export function sanitizeMonitorEvent(raw: unknown, now = Date.now()): MonitorEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;

  const at = timestamp(input.at, now);
  const route = normalizeRoute(input.route);
  const id = eventId(input.id);

  if (input.kind === 'error') {
    const message = clip(input.message, MAX_MESSAGE_LENGTH);
    if (!message) return null;
    const source =
      input.source === 'server' || input.source === 'boundary' ? input.source : 'client';
    const digest = clip(input.digest, MAX_DIGEST_LENGTH);
    const status = Number.isInteger(input.status) ? Number(input.status) : null;

    const event: ErrorMonitorEvent = { kind: 'error', id, at, route, source, message };
    if (digest) event.digest = digest;
    if (status !== null && status >= 100 && status <= 599) event.status = status;
    return event;
  }

  if (input.kind === 'vital') {
    const metric = input.metric;
    if (!isVitalName(metric)) return null;
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 0) return null;
    // A whole-minute LCP or a giant CLS is noise, not a measurement.
    const bounded = Math.min(Math.round(value * 1000) / 1000, 600_000);
    const navigationType = clip(input.navigationType, 24);

    const event: VitalMonitorEvent = {
      kind: 'vital',
      id,
      at,
      route,
      metric,
      value: bounded,
      rating: rateVital(metric, bounded),
    };
    if (navigationType) event.navigationType = navigationType;
    return event;
  }

  return null;
}

/** Nearest-rank percentile on a copy, so the caller's array is untouched. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)] ?? 0;
}

export interface MonitorErrorGroup {
  key: string;
  message: string;
  source: ErrorMonitorEvent['source'];
  route: string;
  count: number;
  lastSeen: string;
  digest?: string;
}

export interface MonitorVitalRow {
  metric: VitalName;
  route: string;
  count: number;
  p75: number;
  rating: VitalRating;
}

export interface MonitorVitalSummary {
  metric: VitalName;
  count: number;
  p75: number;
  rating: VitalRating;
  /** Routes with samples for this metric, busiest first. */
  routes: MonitorVitalRow[];
}

export interface MonitorSummary {
  generatedAt: string;
  windowHours: number;
  totalEvents: number;
  errorCount: number;
  /** Repeated failures collapse into one row with a count. */
  errors: MonitorErrorGroup[];
  vitals: MonitorVitalSummary[];
  /** Non-"good" route/metric pairs, worst first, for the slow-pages list. */
  slowRoutes: MonitorVitalRow[];
}

const RATING_RANK: Record<VitalRating, number> = {
  poor: 2,
  'needs-improvement': 1,
  good: 0,
};

/**
 * Records → the numbers an owner reads: how many failures, which ones repeat,
 * and the p75 of every Web Vital overall and per route.
 *
 * p75 (not the mean) is what Core Web Vitals is judged on: a fast majority of
 * visits must not hide a slow tail, and one 30s outlier must not sink a page
 * that is consistently fine.
 */
export function summarizeMonitorEvents(
  events: readonly MonitorEvent[],
  options: { now?: number; windowHours?: number } = {},
): MonitorSummary {
  const now = options.now ?? Date.now();
  const windowHours = options.windowHours ?? MONITOR_WINDOW_HOURS;
  const since = now - windowHours * 60 * 60_000;

  const inWindow = events.filter((event) => {
    const at = Date.parse(event.at);
    return Number.isFinite(at) && at >= since && at <= now + 60_000;
  });

  const groups = new Map<string, MonitorErrorGroup>();
  for (const event of inWindow) {
    if (event.kind !== 'error') continue;
    const key = `${event.route}|${event.source}|${event.message}`;
    const existing = groups.get(key);
    if (!existing) {
      const group: MonitorErrorGroup = {
        key,
        message: event.message,
        source: event.source,
        route: event.route,
        count: 1,
        lastSeen: event.at,
      };
      if (event.digest) group.digest = event.digest;
      groups.set(key, group);
      continue;
    }
    existing.count += 1;
    if (event.at >= existing.lastSeen) {
      existing.lastSeen = event.at;
      if (event.digest) existing.digest = event.digest;
    }
  }

  const errors = [...groups.values()].sort(
    (a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen),
  );

  const byMetricRoute = new Map<string, number[]>();
  const byMetric = new Map<VitalName, number[]>();
  for (const event of inWindow) {
    if (event.kind !== 'vital') continue;
    const pairKey = `${event.metric}|${event.route}`;
    const pairValues = byMetricRoute.get(pairKey);
    if (pairValues) pairValues.push(event.value);
    else byMetricRoute.set(pairKey, [event.value]);
    const metricValues = byMetric.get(event.metric);
    if (metricValues) metricValues.push(event.value);
    else byMetric.set(event.metric, [event.value]);
  }

  const rows: MonitorVitalRow[] = [];
  for (const [pairKey, values] of byMetricRoute) {
    const separator = pairKey.indexOf('|');
    const metric = pairKey.slice(0, separator);
    const route = pairKey.slice(separator + 1);
    if (!isVitalName(metric)) continue;
    const p75 = percentile(values, 0.75);
    rows.push({ metric, route, count: values.length, p75, rating: rateVital(metric, p75) });
  }

  const vitals: MonitorVitalSummary[] = VITAL_NAMES.map((metric) => {
    const values = byMetric.get(metric) ?? [];
    const p75 = values.length > 0 ? percentile(values, 0.75) : 0;
    return {
      metric,
      count: values.length,
      p75,
      rating: rateVital(metric, p75),
      routes: rows
        .filter((row) => row.metric === metric)
        .sort((a, b) => b.count - a.count || b.p75 - a.p75),
    };
  });

  const slowRoutes = rows
    .filter((row) => row.rating !== 'good')
    .sort(
      (a, b) =>
        RATING_RANK[b.rating] - RATING_RANK[a.rating] || b.p75 - a.p75 || b.count - a.count,
    )
    .slice(0, 8);

  return {
    generatedAt: new Date(now).toISOString(),
    windowHours,
    totalEvents: inWindow.length,
    errorCount: errors.reduce((sum, group) => sum + group.count, 0),
    errors,
    vitals,
    slowRoutes,
  };
}
