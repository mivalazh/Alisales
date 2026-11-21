import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTERS } from '@alisales/schemas';

/**
 * `supabase-read-timeout.test.ts` proves the helper works in isolation. This
 * proves the helper is actually *installed*: both `createClient()` call sites
 * (the public catalogue read client and the service-role admin client) must hand
 * it over as `global.fetch`. Otherwise a real query would hang for the platform
 * default even though the helper is perfect on its own.
 *
 * The proof runs the real `@supabase/supabase-js` against a fetch stub that only
 * ever settles when aborted. No signal → the stub rejects immediately, so a
 * missing wiring fails fast instead of looking like a timeout.
 *
 * The 2.5s default is used deliberately, and both queries run concurrently, so
 * the test costs one read budget (~2.5s) rather than one per client.
 */

interface StubbedCall {
  url: string;
  signal: AbortSignal | null;
}

const calls: StubbedCall[] = [];

function requestUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

const stallUntilAborted = (input: unknown, init?: RequestInit): Promise<Response> => {
  const signal = init?.signal ?? null;
  calls.push({ url: requestUrl(input), signal });
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
  it('aborts a stalled query issued through both createClient call sites', async () => {
    const { searchListings } = await import('../apps/web/lib/data/listings');
    const { admin } = await import('../apps/web/lib/data/s2-store');

    const started = Date.now();

    // Public catalogue client: search_listings arrives as a PostgREST RPC POST.
    const catalogRead = searchListings(DEFAULT_FILTERS, 'car');
    const rpcCall = await waitForCall((call) => call.url.includes('/rest/v1/rpc/'));

    // Service-role client: a plain table GET. Postgrest builders are lazy, so the
    // request only goes out once the builder is awaited; the caller signal is here
    // to stop postgrest's own GET retry loop after the budget has been observed.
    const caller = new AbortController();
    const serviceClient = admin();
    expect(serviceClient).not.toBeNull();
    const adminRead = serviceClient!
      .from('users')
      .select('id')
      .eq('phone', '09120000000')
      .abortSignal(caller.signal)
      .maybeSingle()
      .then(
        () => 'settled',
        () => 'errored',
      );
    const tableCall = await waitForCall((call) => call.url.includes('/rest/v1/users'));

    for (const call of [rpcCall, tableCall]) {
      expect(call.signal).not.toBeNull();
      expect(call.signal?.aborted).toBe(false);
    }

    await Promise.all([waitForAbort(rpcCall.signal!, 6_000), waitForAbort(tableCall.signal!, 6_000)]);

    const elapsed = Date.now() - started;
    expect(rpcCall.signal?.aborted).toBe(true);
    expect(tableCall.signal?.aborted).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(2_300);
    expect(elapsed).toBeLessThan(6_000);

    // The abort surfaced as a failed read; the catalogue falls back to seeds.
    expect(await catalogRead).not.toHaveLength(0);

    caller.abort();
    // Settled either way: the point is that the query returned instead of hanging.
    expect(['settled', 'errored']).toContain(await adminRead);
  }, 20_000);
});
