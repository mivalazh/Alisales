import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SUPABASE_READ_TIMEOUT_MS,
  supabaseFetch,
} from '../apps/web/lib/data/supabase-fetch';

/**
 * The read budget is a production safety net, so it is tested by behaviour, not
 * by reading the constant: a stalled request must reject *because it was
 * aborted*, and a write must never be cut off.
 */

const SELECT_URL = 'https://project.supabase.co/rest/v1/listing_cards?select=*';
const RPC_URL = 'https://project.supabase.co/rest/v1/rpc/search_listings';
const WRITE_URL = 'https://project.supabase.co/rest/v1/listings';
const UPLOAD_URL = 'https://project.supabase.co/storage/v1/object/listing-photos/a.webp';

/** A fetch that never answers on its own and only settles when aborted. */
function stallUntilAborted(_input: unknown, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) return; // no budget attached: hangs forever, like a stalled socket
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

describe('supabase read budget', () => {
  it('ships a 2.5s budget', () => {
    expect(SUPABASE_READ_TIMEOUT_MS).toBe(2_500);
  });

  it('aborts a stalled GET and rejects instead of hanging', async () => {
    globalThis.fetch = vi.fn(stallUntilAborted) as typeof fetch;

    await expect(supabaseFetch(SELECT_URL, {}, 25)).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  it('does not hang at all: the rejection wins a 1s race', async () => {
    globalThis.fetch = vi.fn(stallUntilAborted) as typeof fetch;

    const outcome = await Promise.race([
      supabaseFetch(SELECT_URL, {}, 25).then(
        () => 'resolved',
        () => 'rejected',
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve('still-waiting'), 1_000)),
    ]);

    expect(outcome).toBe('rejected');
  });

  it('aborts a stalled PostgREST RPC, which arrives as a POST', async () => {
    globalThis.fetch = vi.fn(stallUntilAborted) as typeof fetch;

    await expect(
      supabaseFetch(RPC_URL, { method: 'POST', body: '{}' }, 25),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('leaves a table write unbudgeted, so a slow save still completes', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 201 })) as typeof fetch;

    const response = await supabaseFetch(WRITE_URL, { method: 'POST', body: '{}' }, 1);
    expect(response.status).toBe(201);
    // No signal was attached: the caller's request is untouched.
    expect((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1])
      .not.toHaveProperty('signal');
  });

  it('leaves a storage upload unbudgeted', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;

    await supabaseFetch(
      UPLOAD_URL,
      { method: 'POST', body: new Uint8Array([1, 2, 3]) },
      1,
    );

    expect((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1])
      .not.toHaveProperty('signal');
  });

  it('keeps a caller-supplied abort signal working alongside the budget', async () => {
    globalThis.fetch = vi.fn(stallUntilAborted) as typeof fetch;
    const caller = new AbortController();

    const pending = supabaseFetch(SELECT_URL, { signal: caller.signal }, 5_000);
    caller.abort(new DOMException('cancelled by caller', 'AbortError'));

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('enforces the real 2.5s default on a stalled read', async () => {
    globalThis.fetch = vi.fn(stallUntilAborted) as typeof fetch;
    const started = Date.now();

    await expect(supabaseFetch(SELECT_URL)).rejects.toMatchObject({
      name: 'TimeoutError',
    });

    const elapsed = Date.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(2_300);
    expect(elapsed).toBeLessThan(6_000);
  }, 15_000);
});
