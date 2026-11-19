/**
 * Browser-side reporting.
 *
 * Two rules keep this safe to call from anywhere, including an error boundary:
 * it never throws, and it never waits. A failed report is silently dropped —
 * the page the user is looking at matters more than the telemetry.
 *
 * `sendBeacon` is preferred because Web Vitals are flushed while the document
 * is being hidden or unloaded, when a normal `fetch` is usually cancelled. The
 * `fetch` fallback uses `keepalive` for the same reason.
 */

const ENDPOINT = '/api/monitor';

/** Beacons are capped at 64KB by spec; stay well under it. */
const MAX_PAYLOAD_BYTES = 12_000;
const MAX_MESSAGE_LENGTH = 300;

export interface ClientErrorReport {
  kind: 'error';
  route: string;
  message: string;
  source?: 'client' | 'boundary';
  digest?: string;
  at?: string;
  id?: string;
}

export interface ClientVitalReport {
  kind: 'vital';
  route: string;
  metric: string;
  value: number;
  rating?: string;
  navigationType?: string;
  at?: string;
  id?: string;
}

export type ClientMonitorEvent = ClientErrorReport | ClientVitalReport;

export function sendMonitorEvents(events: readonly ClientMonitorEvent[]): void {
  if (typeof window === 'undefined' || events.length === 0) return;

  let body: string;
  try {
    body = JSON.stringify({ events });
  } catch {
    return;
  }
  if (body.length > MAX_PAYLOAD_BYTES) return;

  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // Older/blocked beacon implementations fall through to fetch.
  }

  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Offline or blocked: dropping the report is the correct outcome.
    });
  } catch {
    // A synchronous fetch failure must never surface in the UI.
  }
}

function clipMessage(message: unknown): string {
  if (typeof message !== 'string') return 'Unknown client error';
  const cleaned = message.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  return cleaned.slice(0, MAX_MESSAGE_LENGTH) || 'Unknown client error';
}

/**
 * Report a failure caught by a React error boundary. The pathname is read at
 * call time because an error boundary can replace a segment of the tree.
 */
export function reportBoundaryError(
  error: { message?: string; digest?: string } | null | undefined,
  route?: string,
  source: 'boundary' | 'client' = 'boundary',
): void {
  const path = route ?? (typeof window === 'undefined' ? '/' : window.location.pathname);
  sendMonitorEvents([
    {
      kind: 'error',
      source,
      route: path || '/',
      message: clipMessage(error?.message),
      ...(error?.digest ? { digest: error.digest } : {}),
      at: new Date().toISOString(),
    },
  ]);
}
