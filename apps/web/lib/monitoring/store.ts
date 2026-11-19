import { readJson, writeJson } from '../storage/demo-store';
import {
  MONITOR_MAX_EVENTS,
  summarizeMonitorEvents,
  type MonitorEvent,
  type MonitorSummary,
} from './events';

/**
 * Where monitoring reports land.
 *
 * Three outputs, each useful on its own, none of them a new dependency:
 *
 *  1. A capped ring buffer (newest 500 reports, 7-day retention) in the app's
 *     own store. On Node/self-host that is a file and survives restarts; on
 *     Workers the fixture store is isolate memory, so the buffer is a best-
 *     effort local view rather than a fleet-wide log.
 *  2. One structured JSON line per report on stdout/stderr, tagged
 *     `[alisales:monitor]`. That is what a platform log viewer (including
 *     `wrangler tail`) reads, and it is the durable record on Workers.
 *  3. An optional fire-and-forget POST to `MONITORING_WEBHOOK_URL` when the
 *     operator points it at a collector. Both sides are best-effort: telemetry
 *     must never be the reason a page or an API call fails.
 */

const FILE = 'monitoring.json';
const RETAIN_MS = 7 * 24 * 60 * 60_000;
const FORWARD_TIMEOUT_MS = 2_500;

interface MonitorFile {
  events: MonitorEvent[];
}

/** Stored reports, newest last, trimmed by age and count. */
function load(): MonitorEvent[] {
  let stored: Partial<MonitorFile>;
  try {
    stored = readJson<Partial<MonitorFile>>(FILE, () => ({}));
  } catch {
    return [];
  }
  const events = Array.isArray(stored.events) ? stored.events : [];
  const cutoff = Date.now() - RETAIN_MS;
  const fresh = events.filter((event) => {
    const at = Date.parse(event.at);
    return Number.isFinite(at) && at >= cutoff;
  });
  return fresh.slice(-MONITOR_MAX_EVENTS);
}

function webhookUrl(): string | null {
  const raw = process.env.MONITORING_WEBHOOK_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

async function forward(events: readonly MonitorEvent[]): Promise<void> {
  const url = webhookUrl();
  if (!url) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'alisales', sentAt: new Date().toISOString(), events }),
      signal: controller.signal,
    });
  } catch {
    // The webhook is a convenience, never a correctness requirement.
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Persist a batch of already-sanitised reports and log them.
 *
 * Awaited by the ingest route so the webhook POST is still alive when the
 * Worker responds; callers that cannot wait (the server error hook) may drop
 * the returned promise.
 */
export async function recordMonitorEvents(events: readonly MonitorEvent[]): Promise<void> {
  if (events.length === 0) return;

  try {
    writeJson(FILE, { events: [...load(), ...events].slice(-MONITOR_MAX_EVENTS) });
  } catch {
    // A full disk or a read-only isolate must not break the request.
  }

  for (const event of events) {
    const line = `[alisales:monitor] ${JSON.stringify(event)}`;
    if (event.kind === 'error') console.warn(line);
    else console.info(line);
  }

  await forward(events);
}

export interface MonitorConfig {
  /** Host of the configured collector, if any. Never the full URL. */
  webhookHost: string | null;
  /** Public uptime/target URL, when the operator records one. */
  uptimeUrl: string | null;
}

export interface MonitorSnapshot extends MonitorSummary {
  config: MonitorConfig;
}

export function monitorConfig(): MonitorConfig {
  let webhookHost: string | null = null;
  const url = webhookUrl();
  if (url) {
    try {
      webhookHost = new URL(url).host;
    } catch {
      webhookHost = null;
    }
  }
  return {
    webhookHost,
    uptimeUrl: process.env.MONITORING_UPTIME_URL?.trim() || null,
  };
}

/** The read model behind `/api/monitor` (GET) and `/admin/monitoring`. */
export function monitorSnapshot(windowHours?: number): MonitorSnapshot {
  return {
    ...summarizeMonitorEvents(load(), windowHours ? { windowHours } : {}),
    config: monitorConfig(),
  };
}
