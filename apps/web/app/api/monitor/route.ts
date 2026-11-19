import { NextResponse } from 'next/server';
import { adminSession } from '@/lib/admin/guard';
import { sanitizeMonitorEvent } from '@/lib/monitoring/events';
import { monitorSnapshot, recordMonitorEvents } from '@/lib/monitoring/store';
import { rateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * `/api/monitor` — the app's telemetry sink and read model.
 *
 * POST is the public write path used by the browser (Web Vitals beacons and
 * error boundaries) and by tests. It is deliberately unauthenticated — an
 * error before sign-in still matters — so it trusts nothing: same-origin only,
 * rate limited per client, hard body cap, every field sanitised, and the
 * answer is always 202 so a probe cannot learn anything from the response.
 *
 * GET is the read path. It answers only to `MONITORING_TOKEN` (for a cron or a
 * dashboard outside the app) or to an owner session, and 404 otherwise so the
 * endpoint never advertises itself.
 */

const MAX_BODY_BYTES = 16_384;
const MAX_EVENTS_PER_REQUEST = 25;

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // beacons and same-origin fetches may omit it
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

/** Length-independent comparison so a token cannot be guessed byte by byte. */
function tokenMatches(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected || provided.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return diff === 0;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const limited = rateLimit({
    request,
    bucket: 'monitor-ingest',
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return new NextResponse(null, {
      status: 429,
      headers: { 'Retry-After': String(limited.retryAfterSeconds) },
    });
  }

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Accept a single event, an array, or `{ events: [...] }` so a test, a
  // script and the browser can all post the obvious shape.
  const candidates = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { events?: unknown }).events)
      ? ((parsed as { events: unknown[] }).events ?? [])
      : [parsed];

  const events = candidates
    .slice(0, MAX_EVENTS_PER_REQUEST)
    .map((candidate) => sanitizeMonitorEvent(candidate))
    .filter((event) => event !== null);

  if (events.length > 0) {
    try {
      await recordMonitorEvents(events);
    } catch {
      // Telemetry must never fail the caller, even if the sink is broken.
    }
  }

  return NextResponse.json(
    { ok: true, accepted: events.length },
    { status: 202, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  const tokenAuthorized = tokenMatches(bearerToken(request), process.env.MONITORING_TOKEN?.trim());
  const authorized = tokenAuthorized || Boolean(await adminSession());
  if (!authorized) {
    // Same answer as a missing route: monitoring data is not public.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(monitorSnapshot(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
