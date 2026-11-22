import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTERS } from '@alisales/schemas';

/**
 * `supabase-read-timeout.test.ts` proves the helper works in isolation. This
 * proves the helper is actually *installed*: both `createClient()` call sites
 * (the public catalogue read client and the service-role admin client) must hand
 * it over as `global.fetch`. Otherwise a real query would hang for the platform
 * default even though the helper is perfect on its own.
 *
 * It also pins the *total* settle time. The budget lives inside the fetch
 * wrapper, so it applies per attempt: postgrest-js happily retries a rejected
 * idempotent request three times (1s, 2s, 4s backoff), and every retry would
 * start a fresh 2.5s clock — one stalled query would cost ~15s instead of 2.5s.
 * Both clients therefore pass `db: { retry: false }`, and the assertions below
 * fail if a query is retried or takes more than one budget to give up.
 *
 * The proof runs the real `@supabase/supabase-js` against a fetch stub that only
 * ever settles when aborted. No signal → the stub rejects immediately, so a
 * missing wiring fails fast instead of looking like a timeout. Both queries run
 * concurrently, so the test costs one read budget (~2.5s) rather than one each.
 */

interface StubbedCall {
  url: string;
  signal: AbortSignal | null;
  headers: HeadersInit | undefined;
}

const calls: StubbedCall[] = [];

function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

const stallUntilAborted = (input: unknown, init?: RequestInit): Promise<Response> => {
  const signal = init?.signal ?? null;
  calls.push({ url: requestUrl(input), signal, headers: init?.headers });
  if (!signal) {
    // No budget reached the network: that is the regression this test guards.
    return Promise.reject(new Error('supabase request left without an abort budget'));
  }
  return new Promise((_resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
};

/** postgrest-js stamps retried attempts with `X-Retry-Count`. */
function retryCount(call: StubbedCall): string | null {
  const { headers } = call;
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get('X-Retry-Count');
  if (Array.isArray(headers)) {
    const hit = headers.find(([key]) => key.toLowerCase() === 'x-retry-count');
    return hit?.[1] ?? null;
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((name) => name.toLowerCase() === 'x-retry-count');
  return key ? record[key] : null;
}

async function waitForCall(match: (call: StubbedCall) => boolean): Promise<StubbedCall> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const found = calls.find(match);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`no Supabase request reached fetch: ${JSON.stringify(calls.map((c) => c.url))}`);
}

/** Polls until the budget on the wire fires. */
async function waitForAbort(signal: AbortSignal, withinMs: number): Promise<void> {
  const deadline = Date.now() + withinMs;
  while (Date.now() < deadline) {
    if (signal.aborted) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('the request budget never fired');
}

const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;
const savedEnv = new Map<string, string | undefined>();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv.set(key, process.env[key]);
  }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  calls.length = 0;
  globalThis.fetch = vi.fn(stallUntilAborted) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
  calls.length = 0;
});

describe('supabase clients carry the read budget', () => {
  it('settles a stalled query in one budget for both createClient call sites', async () => {
    const { searchListings } = await import('../apps/web/lib/data/listings');
    const { admin } = await import('../apps/web/lib/data/s2-store');

    const started = Date.now();

    // Public catalogue client: search_listings arrives as a PostgREST RPC POST.
    const catalogRead = searchListings(DEFAULT_FILTERS, 'car');
    const rpcCall = await waitForCall((call) => call.url.includes('/rest/v1/rpc/'));

    // Service-role client: a plain table GET. No caller signal: the client's own
    // budget is what has to end the query, exactly as on a page render.
    const serviceClient = admin();
    expect(serviceClient).not.toBeNull();
    // Postgrest builders are lazy; subscribing (`.then`) is what sends the GET.
    const adminRead = Promise.resolve(
      serviceClient!
        .from('users')
        .select('id')
        .eq('phone', '09120000000')
        .maybeSingle(),
    );
    const tableCall = await waitForCall((call) => call.url.includes('/rest/v1/users'));

    for (const call of [rpcCall, tableCall]) {
      expect(call.signal).not.toBeNull();
      expect(call.signal?.aborted).toBe(false);
    }

    await Promise.all([waitForAbort(rpcCall.signal!, 6_000), waitForAbort(tableCall.signal!, 6_000)]);
    const abortedAt = Date.now();

    expect(rpcCall.signal?.aborted).toBe(true);
    expect(tableCall.signal?.aborted).toBe(true);
    // One budget (~2.5s), not one per postgrest retry.
    expect(abortedAt - started).toBeGreaterThanOrEqual(2_300);
    expect(abortedAt - started).toBeLessThan(4_000);

    // Both queries return instead of hanging: the admin read resolves with the
    // abort as a PostgREST error, the catalogue falls back to its seeded rows.
    const [adminResult, catalogRows] = await Promise.all([adminRead, catalogRead]);
    const settledAt = Date.now();
    expect(settledAt - started).toBeLessThan(4_000);
    expect(adminResult.error).not.toBeNull();
    expect(catalogRows).not.toHaveLength(0);

    // No retries: a retried GET would issue another fetch and carry the header.
    expect(calls.filter((call) => call.url.includes('/rest/v1/users'))).toHaveLength(1);
    for (const call of calls) expect(retryCount(call)).toBeNull();
  }, 20_000);
});
