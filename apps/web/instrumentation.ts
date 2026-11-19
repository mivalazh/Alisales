/**
 * Server-side telemetry entry point (Next.js instrumentation hook).
 *
 * `onRequestError` fires once for every unhandled error on the server — a
 * route handler throwing, a server component failing to render, a proxy or
 * middleware error. Next streams a sanitised digest to the browser, so without
 * this hook the real message and stack would only exist in that one response.
 *
 * The hook is deliberately defensive: it must never turn one failure into two,
 * so every step is guarded and the imports are dynamic (a problem loading the
 * monitoring bundle degrades to "no report", not "the app is down").
 *
 * Nothing here reads headers, cookies or bodies: the stored record is the
 * route path, the error message, the digest and the status. See
 * `lib/monitoring/events.ts` for the contract.
 */

const IGNORED_PATH =
  /^\/(?:_next\/|favicon|icons\/|sw\.js)|\.(?:png|jpe?g|webp|avif|svg|ico|css|js|mjs|map|txt|xml|webmanifest)$/i;

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || 'Server error';
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return 'Unknown server error';
}

export async function onRequestError(
  error: unknown,
  request?: { path?: string; method?: string },
  context?: { routePath?: string; routeType?: string },
): Promise<void> {
  try {
    const path = request?.path ?? context?.routePath ?? '/';
    if (IGNORED_PATH.test(path)) return;

    const digest =
      error && typeof error === 'object'
        ? (error as { digest?: unknown }).digest
        : undefined;

    // Pure and runtime-agnostic, so it is safe in both builds.
    const { sanitizeMonitorEvent } = await import('./lib/monitoring/events');
    const event = sanitizeMonitorEvent({
      kind: 'error',
      source: 'server',
      route: path,
      message: messageOf(error),
      ...(typeof digest === 'string' ? { digest } : {}),
    });
    if (!event) return;

    // Next compiles this file for the Node and Edge runtimes. The store reaches
    // the app's data layer (and a filesystem on Node), which does not exist on
    // Edge, so only the Node build may import it. `NEXT_RUNTIME` is inlined at
    // build time, so this branch is eliminated from the Edge bundle.
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      const { recordMonitorEvents } = await import('./lib/monitoring/store');
      await recordMonitorEvents([event]);
      return;
    }

    // Edge: keep the structured log line, which is what the platform reads.
    console.error(`[alisales:monitor] ${JSON.stringify(event)}`);
  } catch {
    // A telemetry failure is not a second production failure.
  }
}

/**
 * No one-time setup is needed — the store opens lazily on first write — but
 * Next calls `register` on boot when it is exported, which is a useful place
 * to keep that statement for the next person.
 */
export async function register(): Promise<void> {
  // Intentionally empty.
}
