// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VehicleCategory } from '@alisales/schemas';
import type { ListingCardData } from '../apps/web/lib/data/listings';
import { catalogueState, type CatalogueState } from '../apps/web/lib/catalogue';
import { useCatalogueRows, type CatalogueRows } from '../apps/web/lib/use-catalogue-rows';

/**
 * Shell wiring for the catalogue fetch.
 *
 * The route has its own tests; this pins the other half of the contract: what
 * the shells send, and what the grid shows while an answer is missing. The
 * failure these guard against is subtle — a URL whose narrowing never keyed the
 * request, or a failed/aborted read replacing the static first paint with an
 * empty grid.
 */

function card(id: string): ListingCardData {
  return { id } as unknown as ListingCardData;
}

const POOL = [card('pool-1'), card('pool-2')];
const SERVER_ROWS = [card('server-1'), card('server-2'), card('server-3')];

let container: HTMLDivElement;
let root: Root;
let latest: CatalogueRows | null = null;

function Probe({
  pool,
  state,
  category,
}: {
  pool: ListingCardData[];
  state: CatalogueState;
  category?: VehicleCategory;
}) {
  latest = useCatalogueRows(pool, state, category);
  return null;
}

/** Renders (or re-renders) the hook and lets pending promises settle inside act. */
async function render(params: URLSearchParams, category?: VehicleCategory): Promise<void> {
  await act(async () => {
    root.render(createElement(Probe, { pool: POOL, state: catalogueState(params), category }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  latest = null;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function requestedUrl(call: number): string {
  return (fetchMock.mock.calls[call] as unknown as [string, RequestInit])[0];
}

describe('useCatalogueRows', () => {
  it('requests the codec-built query for the URL and adopts a successful answer', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ rows: SERVER_ROWS }) });

    await render(new URLSearchParams('brand=bmw&body=suv&sort=priceAsc'), 'car');

    // `sort` stays client-side; the codec's filters, the extra narrowing and the
    // category are what the server needs to return the full matching set, and
    // they are emitted in canonical (sorted) order so one view is one cache key.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requestedUrl(0)).toBe('/api/listings/search?body=suv&brand=bmw&category=car&limit=48');
    expect(latest).toMatchObject({ rows: SERVER_ROWS, serverMatches: true, nextCursor: null });
  });

  it('sends the bare route when the URL has no catalogue state left to send', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ rows: SERVER_ROWS }) });

    await render(new URLSearchParams('sort=newest&utm_source=newsletter'));

    expect(requestedUrl(0)).toBe('/api/listings/search?limit=48');
    expect(latest?.serverMatches).toBe(true);
  });

  it('issues a new request when a parameter changes the query', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ rows: SERVER_ROWS }) });

    await render(new URLSearchParams('body=suv'), 'car');
    await render(new URLSearchParams('body=sedan'), 'car');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestedUrl(0)).toBe('/api/listings/search?body=suv&category=car&limit=48');
    expect(requestedUrl(1)).toBe('/api/listings/search?body=sedan&category=car&limit=48');
  });

  it('builds one cache key for one view, whatever order the URL used', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ rows: SERVER_ROWS }) });

    await render(new URLSearchParams('brand=bmw&body=suv'), 'car');
    await render(new URLSearchParams('body=suv&brand=bmw'), 'car');

    // The route's canonical redirect must never be on the hot path: the hook
    // asks for the canonical URL directly, so reordering the same filters is
    // not a second cache entry or a second request.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not re-request when a parameter the request ignores changes', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ rows: SERVER_ROWS }) });

    await render(new URLSearchParams('sort=priceAsc'));
    await render(new URLSearchParams('sort=newest'));

    // Sorting is client-side, so the query is unchanged and the answer stands.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the static pool when the request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    await render(new URLSearchParams('body=suv'), 'car');

    expect(latest).toMatchObject({ rows: POOL, serverMatches: false });
    expect(latest?.rows).toBe(POOL);
  });

  it('appends the next page on loadMore and de-duplicates a row that moved', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rows: [SERVER_ROWS[0]], nextCursor: 'page-2' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        // `server-1` appears again: two reads are not one snapshot.
        json: async () => ({ rows: [SERVER_ROWS[1], SERVER_ROWS[0]], nextCursor: null }),
      });

    await render(new URLSearchParams('body=suv'), 'car');
    expect(latest?.rows).toEqual([SERVER_ROWS[0]]);
    expect(latest?.nextCursor).toBe('page-2');

    await act(async () => {
      latest?.loadMore();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(requestedUrl(1)).toContain('cursor=page-2');
    expect(latest?.rows).toEqual([SERVER_ROWS[0], SERVER_ROWS[1]]);
    expect(latest?.nextCursor).toBeNull();
  });

  it('keeps the static pool when the request rejects', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    await render(new URLSearchParams('body=suv'), 'car');

    expect(latest?.rows).toBe(POOL);
    expect(latest?.serverMatches).toBe(false);
  });

  it('keeps the static pool while a request is pending and aborts it on a new query', async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal!;
          signals.push(signal);
          signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    await render(new URLSearchParams('body=suv'), 'car');
    // Nothing has answered yet: the rendered pool is the honest first paint.
    expect(latest?.rows).toBe(POOL);
    expect(latest?.serverMatches).toBe(false);
    expect(signals[0]?.aborted).toBe(false);

    await render(new URLSearchParams('origin=original'));

    // The first request was cancelled by the effect cleanup, and the grid is
    // still the static pool until the second one answers.
    expect(signals[0]?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(latest?.rows).toBe(POOL);
    expect(latest?.serverMatches).toBe(false);
  });
});
