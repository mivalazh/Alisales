'use client';

import { useEffect, useState } from 'react';
import { serializeFilters, type SearchFilters, type VehicleCategory } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';

/**
 * Rows for the URL — the whole matching pool once the browser has it.
 *
 * The catalogue shells render a 48-row static pool for the first paint and the
 * edge cache. That render only holds the newest rows, so narrowing it in the
 * browser hides real inventory: a brand or keyword matching row 49 looked
 * empty, and the unfiltered grid could never show past row 48. After hydration
 * this hook asks `/api/listings/search` — the one server-side read, parsed with
 * the same URL codec — with the URL's filters or none at all, and hands back
 * every match.
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
}

/**
 * The request for these filters, built with the shared URL codec so the route
 * parses exactly what the page parsed. Sort, `body`, `kind` and the parts
 * attributes are client-side narrowing only, so they never key a request.
 *
 * `bodyType` does key one: hosted rows carry the stored class, and the shells
 * narrow the static pool's legacy rows by inferred model instead, so a row
 * without a stored class can drop out once the server answers.
 */
function catalogueSearchQuery(
  filters: SearchFilters,
  category?: VehicleCategory,
): string {
  const params = new URLSearchParams(serializeFilters(filters));
  if (category) params.set('category', category);
  return params.toString();
}

export function useCatalogueRows(
  staticPool: ListingCardData[],
  filters: SearchFilters,
  category?: VehicleCategory,
): CatalogueRows {
  const query = catalogueSearchQuery(filters, category);
  const [response, setResponse] = useState<{ query: string; rows: ListingCardData[] } | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();
    const url = query ? `/api/listings/search?${query}` : '/api/listings/search';
    fetch(url, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { rows?: ListingCardData[] } | null) => {
        // An empty answer is a real answer — a filter can match nothing. Only a
        // failed request keeps the static pool.
        if (body && Array.isArray(body.rows)) setResponse({ query, rows: body.rows });
      })
      .catch(() => {
        // Aborted, offline or malformed: the static pool is still a first paint.
      });
    return () => controller.abort();
  }, [query]);

  // A navigation to another category ships a different static pool and query;
  // until the matching answer lands, that pool is the honest first paint.
  if (!response || response.query !== query) return { rows: staticPool, serverMatches: false };
  return { rows: response.rows, serverMatches: true };
}
