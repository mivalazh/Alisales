import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SUPABASE_READ_TIMEOUT_MS,
  supabaseFetch,
} from '../apps/web/lib/data/supabase-fetch';

/**
 * The read budget is a production safety net, so it is tested by behaviour, not
 * by reading the constant: a stalled request must reject *because it was
 * aborted*, and a write must never be cut off.
 *
 * The 2.5s default on a real client is covered end-to-end in
 * `supabase-client-wiring.test.ts`; here every test passes a tiny budget so the
 * unit contract stays sub-second.
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

type FetchMock = ReturnType<typeof vi.fn> & { mock: { calls: [unknown, RequestInit?][] } };

function mockFetch(implementation: (input: unknown, init?: RequestInit) => Promise<Response>): FetchMock {
  const mock = vi.fn(implementation) as unknown as FetchMock;
  globalThis.fetch = mock as unknown as typeof fetch;
  return mock;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('supabase read budget', () => {
  it('ships a 2.5s budget', () => {
    expect(SUPABASE_READ_TIMEOUT_MS).toBe(2_500);
  });

  it('aborts a stalled read: it rejects as TimeoutError and wins a 1s race', async () => {
    const fetchMock = mockFetch(stallUntilAborted);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const stillWaiting = new Promise<string>((resolve) => {
      timer = setTimeout(() => resolve('still-waiting'), 1_000);
    });

    const outcome = await Promise.race([
      supabaseFetch(SELECT_URL, {}, 25).then(
        () => 'resolved',
        (error: unknown) => (error as { name?: string }).name ?? 'rejected',
      ),
      stillWaiting,
    ]).finally(() => clearTimeout(timer));

    expect(outcome).toBe('TimeoutError');
    // The abort reached the actual request, not just the helper's promise.
    const signal = fetchMock.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(true);
  });

  it('aborts a stalled PostgREST RPC, which arrives as a POST', async () => {
    mockFetch(stallUntilAborted);

    await expect(
      supabaseFetch(RPC_URL, { method: 'POST', body: '{}' }, 25),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('leaves table writes and storage uploads unbudgeted', async () => {
    const fetchMock = mockFetch(async () => new Response('{}', { status: 201 }));

    await supabaseFetch(WRITE_URL, { method: 'POST', body: '{}' }, 1);
    await supabaseFetch(
      UPLOAD_URL,
      { method: 'POST', body: new Uint8Array([1, 2, 3]) },
      1,
    );

    expect(fetchMock.mock.calls).toHaveLength(2);
    for (const [, init] of fetchMock.mock.calls) {
      // No signal was attached: the caller's request is untouched.
      expect(init).not.toHaveProperty('signal');
    }
  });

  it('keeps a caller-supplied abort signal working alongside the budget', async () => {
    mockFetch(stallUntilAborted);
    const caller = new AbortController();

    const pending = supabaseFetch(SELECT_URL, { signal: caller.signal }, 5_000);
    caller.abort(new DOMException('cancelled by caller', 'AbortError'));

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
