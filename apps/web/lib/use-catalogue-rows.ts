'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { VehicleCategory } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import { canonicalSearchQuery, catalogueRequestQuery, type CatalogueState } from '@/lib/catalogue';

/**
 * Rows for the URL — one keyset page, plus more on demand.
 *
 * The catalogue shells render a 48-row static pool for the first paint and the
 * edge cache. That render only holds the newest rows, so narrowing it in the
 * browser hides real inventory: a brand or keyword matching row 49 looked
 * empty, and the unfiltered grid could never show past row 48. After hydration
 * this hook asks `/api/listings/search` — the one server-side read — for the
 * same `CatalogueState` the view renders and swaps in the server's ranking.
 *
 * The read is paged (0020): the first request carries `limit`, the answer
 * carries the cursor for the next page, and «نمایش بیشتر» appends it. Rows are
 * de-duplicated by id while appending, so a listing that moves between two
 * reads can never be shown twice. A read without a cursor is the whole set
 * (curated `?body=`/`?kind=` views and the fixture catalogue), which is why the
 * control disappears when `nextCursor` is null.
 *
 * The static pool remains the first paint and the fallback: while a request is
 * in flight, offline, or after a failed request the grid shows the rendered
 * rows narrowed locally, which is the previous behaviour and never an empty
 * grid. A successful answer is authoritative even when it is empty — a filter
 * can match nothing.
 */
export interface CatalogueRows {
  rows: ListingCardData[];
  /** True when `rows` are the server's matches for the URL, not the static pool. */
  serverMatches: boolean;
  /** Cursor for the next server page, or null when the set is complete. */
  nextCursor: string | null;
  /** Fetches and appends the next page (a no-op while one is in flight). */
  loadMore: () => void;
  loadingMore: boolean;
}

/** Rows per server page — the same 48 the prerender carries. */
const PAGE_SIZE = 48;

function pageUrl(
  state: CatalogueState,
  category: VehicleCategory | undefined,
  cursor: string | null,
): string {
  const params = new URLSearchParams(catalogueRequestQuery(state, category));
  params.set('limit', String(PAGE_SIZE));
  if (cursor) params.set('cursor', cursor);
  // The route redirects a non-canonical key, so the hook asks for the canonical
  // one directly: the redirect must never be on the grid's hot path.
  return `/api/listings/search?${canonicalSearchQuery(params)}`;
}

interface Page {
  rows: ListingCardData[];
  nextCursor: string | null;
}

export function useCatalogueRows(
  staticPool: ListingCardData[],
  state: CatalogueState,
  category?: VehicleCategory,
): CatalogueRows {
  // Every narrowing key in the URL is part of the request, so `/cars?body=suv`,
  // `/?kind=part` and `/parts?origin=oem` fetch their own matching set instead
  // of sharing `/cars` or `/parts`'s unfiltered answer. `sort` is left out:
  // ordering is the read's ranking plus the grid's own sort.
  const query = catalogueRequestQuery(state, category);
  const firstUrl = pageUrl(state, category, null);
  const [answer, setAnswer] = useState<{ query: string; page: Page } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const moreInFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(firstUrl, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { rows?: ListingCardData[]; nextCursor?: string | null } | null) => {
        // An empty answer is a real answer — a filter can match nothing. Only a
        // failed request keeps the static pool.
        if (body && Array.isArray(body.rows)) {
          setAnswer({ query, page: { rows: body.rows, nextCursor: body.nextCursor ?? null } });
        }
      })
      .catch(() => {
        // Aborted, offline or malformed: the static pool is still a first paint.
      });
    return () => controller.abort();
  }, [firstUrl, query]);

  const loadMore = useCallback(() => {
    if (!answer || answer.query !== query || !answer.page.nextCursor || moreInFlight.current) {
      return;
    }
    moreInFlight.current = true;
    setLoadingMore(true);
    fetch(pageUrl(state, category, answer.page.nextCursor))
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { rows?: ListingCardData[]; nextCursor?: string | null } | null) => {
        if (!body || !Array.isArray(body.rows)) return;
        setAnswer((previous) => {
          if (!previous || previous.query !== query) return previous;
          const seen = new Set(previous.page.rows.map((row) => row.id));
          const rows = [...previous.page.rows, ...body.rows!.filter((row) => !seen.has(row.id))];
          return { query, page: { rows, nextCursor: body.nextCursor ?? null } };
        });
      })
      .catch(() => {
        // A failed page keeps what the grid already shows; the control stays.
      })
      .finally(() => {
        moreInFlight.current = false;
        setLoadingMore(false);
      });
  }, [answer, category, query, state]);

  // A navigation to another category ships a different static pool and query;
  // until the matching answer lands, that pool is the honest first paint.
  if (!answer || answer.query !== query) {
    return { rows: staticPool, serverMatches: false, nextCursor: null, loadMore, loadingMore: false };
  }
  return {
    rows: answer.page.rows,
    serverMatches: true,
    nextCursor: answer.page.nextCursor,
    loadMore,
    loadingMore,
  };
}
