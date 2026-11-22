import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMobileSupabaseClient } from './supabase-client';

/**
 * The mobile client must carry the same read budget as the web clients: a
 * stalled query has to settle in one budget, not the platform default.
 *
 * This runs the real `@supabase/supabase-js` against a fetch stub that only
 * ever settles when aborted. No signal → the stub rejects immediately, so a
 * missing wiring fails fast instead of looking like a slow database. It also
 * pins the *total* settle time: postgrest-js retries idempotent requests three
 * times (1s, 2s, 4s backoff) and each retry would start a fresh 2.5s clock, so
 * `db: { retry: false }` is part of the contract this test protects.
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

async function waitForCall(): Promise<StubbedCall> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const [found] = calls;
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`no Supabase request reached fetch: ${JSON.stringify(calls)}`);
}

async function waitForAbort(signal: AbortSignal, withinMs: number): Promise<void> {
  const deadline = Date.now() + withinMs;
  while (Date.now() < deadline) {
    if (signal.aborted) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('the request budget never fired');
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  calls.length = 0;
  globalThis.fetch = vi.fn(stallUntilAborted) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  calls.length = 0;
});

describe('mobile supabase client', () => {
  it('settles a stalled read in one 2.5s budget, with no retries', async () => {
    const client = createMobileSupabaseClient('https://project.supabase.co', 'anon-key');

    // Builders are lazy; awaiting the query is what sends the GET.
    const started = Date.now();
    const read = Promise.resolve(
      client.from('listings').select('id').eq('id', 'x').maybeSingle(),
    );

    const call = await waitForCall();
    expect(call.url).toContain('/rest/v1/listings');
    expect(call.signal).not.toBeNull();
    expect(call.signal?.aborted).toBe(false);

    await waitForAbort(call.signal!, 6_000);
    const abortedAt = Date.now();
    // One budget, not one per postgrest retry.
    expect(abortedAt - started).toBeGreaterThanOrEqual(2_300);
    expect(abortedAt - started).toBeLessThan(4_000);

    // The query rejects through the normal PostgREST error path instead of hanging.
    const result = await read;
    expect(result.error).not.toBeNull();
    expect(Date.now() - started).toBeLessThan(4_000);

    // A retried GET would issue another fetch and carry the retry header.
    expect(calls).toHaveLength(1);
    expect(retryCount(call)).toBeNull();
  }, 20_000);

  it('leaves writes unbudgeted, so a slow connection cannot lose an edit', async () => {
    const writeCalls: StubbedCall[] = [];
    globalThis.fetch = vi.fn((input: unknown, init?: RequestInit) => {
      writeCalls.push({ url: requestUrl(input), signal: init?.signal ?? null, headers: init?.headers });
      return Promise.resolve(new Response('{}', { status: 201 }));
    }) as unknown as typeof fetch;

    const client = createMobileSupabaseClient('https://project.supabase.co', 'anon-key');
    const result = await client.from('listings').update({ city: 'کیش' }).eq('id', 'x');

    expect(result.error).toBeNull();
    expect(writeCalls).toHaveLength(1);
    expect(writeCalls[0]?.signal).toBeNull();
  });
});
