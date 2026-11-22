import {
  DEFAULT_CITY,
  DEFAULT_FILTERS,
  featureFlags,
  parseFiltersFromSearchParams,
  type SearchFilters,
  type VehicleCategory,
} from '@alisales/schemas';
import { matchesFilters } from './filter-match';
import type { ListingCardData } from './data/listings';

/**
 * URL → visible catalogue rows, on the client.
 *
 * The catalogue pages are statically generated and CDN-cached, so they can no
 * longer read `searchParams` on the server. The pool of rows is rendered once,
 * and this module narrows it in the browser from the same URL the filters
 * commit to — one predicate (`matchesFilters`) shared with the server search,
 * so a chip can never disagree with what the grid shows.
 *
 * Sorting is deliberately left to `Catalog` (`sortListings`), which already
 * owns the sold-last product rule.
 */

/**
 * The URL subset a catalogue shell needs: `useSearchParams()` after hydration,
 * or `null` for the prerendered/default render.
 */
export type CatalogueParams = Pick<URLSearchParams, 'get' | 'forEach'> | null;

/** First value wins, exactly like the old server-side parser. */
export function filtersFromParams(params: CatalogueParams): SearchFilters {
  if (!params) return DEFAULT_FILTERS;
  const raw: Record<string, string> = {};
  params.forEach((value, key) => {
    if (!(key in raw)) raw[key] = value;
  });
  return parseFiltersFromSearchParams(raw);
}

/** The launch rule: while city selection is off, browse is Kish-only. */
function launchFilters(filters: SearchFilters): SearchFilters {
  if (featureFlags.city_selection) return filters;
  return { ...filters, city: [DEFAULT_CITY] };
}

function inCategory(
  listing: ListingCardData,
  category: VehicleCategory | undefined,
): boolean {
  if (listing.kind === 'part') return category === undefined;
  return (listing.category ?? 'car') === (category ?? 'car');
}

export function visibleListings(
  pool: readonly ListingCardData[],
  filters: SearchFilters,
  category?: VehicleCategory,
): ListingCardData[] {
  const effective = launchFilters(filters);
  return pool.filter(
    (listing) => inCategory(listing, category) && matchesFilters(listing, effective),
  );
}

/** Home's `?kind=` switch: vehicles or parts, never both. */
export function byKind(
  listings: readonly ListingCardData[],
  kind: 'vehicle' | 'part' | null,
): ListingCardData[] {
  if (!kind) return [...listings];
  return listings.filter((listing) => (listing.kind === 'part' ? 'part' : 'vehicle') === kind);
}
