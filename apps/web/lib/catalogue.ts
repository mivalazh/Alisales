import {
  DEFAULT_CITY,
  DEFAULT_FILTERS,
  featureFlags,
  parseFiltersFromSearchParams,
  serializeFilters,
  type PartCategory,
  type SearchFilters,
  type VehicleCategory,
} from '@alisales/schemas';
import { matchesFilters } from './filter-match';
import {
  filterByBodyType,
  filterByPartCategory,
  filterPartsByAttributes,
  parseBodyType,
  parsePartCategory,
  type CarBodyType,
  type PartAttributes,
} from './browse';
import { parseSortKey, type SortKey } from './sort';
import type { ListingCardData } from './data/listings';

/**
 * URL → catalogue rows and the request that fetches the rest.
 *
 * The catalogue pages are statically generated and CDN-cached, so they can no
 * longer read `searchParams` on the server. The pool of rows is rendered once,
 * and this module reads the URL in the browser: `catalogueState` parses it
 * once per page, the shells render from that state, and the hook asks the route
 * for the same state's matches. One parse means a chip can never mean one thing
 * to the API and another to the grid.
 *
 * Sorting is deliberately left to `Catalog` (`sortListings`), which already
 * owns the sold-last product rule; the state carries the key, not the order.
 */

/**
 * The URL subset a catalogue shell needs: `useSearchParams()` after hydration,
 * or `null` for the prerendered/default render.
 */
export type CatalogueParams = Pick<URLSearchParams, 'get' | 'forEach'> | null;

/** First value wins, exactly like the old server-side parser. */
function filtersFromParams(params: CatalogueParams): SearchFilters {
  if (!params) return DEFAULT_FILTERS;
  const raw: Record<string, string> = {};
  params.forEach((value, key) => {
    if (!(key in raw)) raw[key] = value;
  });
  return parseFiltersFromSearchParams(raw);
}

/**
 * The URL dimensions that narrow the grid but have no `SearchFilters` column:
 * a curated vehicle body group, the vehicle/part switch, and the parts-only
 * attributes. They key the request as well as the grid, so `/cars?body=suv`
 * fetches its own matching set instead of narrowing the unfiltered prefix.
 */
export interface CatalogueExtras {
  /** Home's `?kind=` switch: vehicles or parts, never both. */
  kind: 'vehicle' | 'part' | null;
  body: CarBodyType | null;
  partCategory: PartCategory | null;
  /** Origin, warranty, compatibility and part condition. */
  partAttributes: PartAttributes;
  /** True when the URL asks for parts, by kind, category or attributes. */
  partsScoped: boolean;
}

export function catalogueExtras(params: CatalogueParams): CatalogueExtras {
  const kindParam = params?.get('kind');
  const kind = kindParam === 'vehicle' || kindParam === 'part' ? kindParam : null;
  const partCategory = parsePartCategory(params?.get('category'));
  const origin = params?.get('origin') ?? null;
  const warranty = params?.get('warranty') === '1';
  const compatibility = params?.get('compat') ?? '';
  const condition = params?.get('pcond') ?? null;

  return {
    kind,
    body: parseBodyType(params?.get('body')),
    partCategory,
    partAttributes: {
      origin,
      warrantyOnly: warranty,
      compatibility,
      condition,
    },
    partsScoped:
      kind === 'part' ||
      partCategory !== null ||
      Boolean(origin) ||
      warranty ||
      Boolean(compatibility.trim()) ||
      Boolean(condition),
  };
}

/** Everything a catalogue page draws from the URL, parsed once. */
export interface CatalogueState {
  filters: SearchFilters;
  sort: SortKey;
  extras: CatalogueExtras;
}

export function catalogueState(params: CatalogueParams): CatalogueState {
  return {
    filters: filtersFromParams(params),
    sort: parseSortKey(params?.get('sort')),
    extras: catalogueExtras(params),
  };
}

/** `null` params: the prerendered/default render, shared by every fallback. */
export const DEFAULT_CATALOGUE_STATE: CatalogueState = catalogueState(null);

/** Marketing tags never change a catalogue view. */
const CACHE_NOISE_PARAM = /^utm_/i;

/**
 * The one URL shape that owns a view's cache entry.
 *
 * Two orderings of one filter set are two URLs, and the edge cache keys on the
 * URL: without canonicalising, the same grid is fetched, stored and re-read
 * once per parameter order. Keys are sorted, values are not — the codec is
 * first-value-wins, so reordering repeated keys would change the filter set —
 * and marketing parameters (`utm_*`) are dropped.
 *
 * Shared by the hook (which asks for the canonical URL directly) and by
 * `/api/listings/search` (which redirects a hand-written URL to it), so the
 * client can never generate a key the route would rewrite.
 */
export function canonicalSearchQuery(params: URLSearchParams): string {
  const entries = [...params.entries()]
    .filter(([key]) => !CACHE_NOISE_PARAM.test(key))
    .sort(([aKey], [bKey]) => (aKey < bKey ? -1 : aKey > bKey ? 1 : 0));
  return new URLSearchParams(entries).toString();
}

/**
 * The request for a parsed page state.
 *
 * Built from the parsed values, so the route reads exactly what the page read.
 * `sort` stays out: ordering is the read's own ranking and the grid sorts
 * client-side.
 */
export function catalogueRequestQuery(
  state: CatalogueState,
  category?: VehicleCategory,
): string {
  const { extras } = state;
  const params = new URLSearchParams(serializeFilters(state.filters));
  if (extras.body) params.set('body', extras.body.key);
  if (extras.kind) params.set('kind', extras.kind);
  const attributes = extras.partAttributes;
  if (attributes.origin) params.set('origin', attributes.origin);
  if (attributes.warrantyOnly) params.set('warranty', '1');
  if (attributes.compatibility?.trim()) params.set('compat', attributes.compatibility.trim());
  if (attributes.condition) params.set('pcond', attributes.condition);
  // A parts category rides in the same key the parts shells use; the route
  // tells the two apart because only vehicle categories are in `vehicleCategories`.
  if (category) params.set('category', category);
  else if (extras.partCategory) params.set('category', extras.partCategory);
  return canonicalSearchQuery(params);
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

/**
 * Apply the non-`SearchFilters` narrowing to rows — the same pass on both sides.
 *
 * The route applies it per page while paging, so a match past the first page is
 * still collected; the views apply it while the static pool is on screen.
 */
export function narrowExtras(
  rows: readonly ListingCardData[],
  extras: CatalogueExtras,
): ListingCardData[] {
  if (!extras.kind && !extras.body && !extras.partCategory && !extras.partsScoped) {
    return [...rows];
  }
  let narrowed = byKind(rows, extras.partsScoped ? 'part' : extras.kind);
  if (extras.body) narrowed = filterByBodyType(narrowed, extras.body);
  if (extras.partCategory) narrowed = filterByPartCategory(narrowed, extras.partCategory);
  if (extras.partsScoped) narrowed = filterPartsByAttributes(narrowed, extras.partAttributes);
  return narrowed;
}

export type { CarBodyType, PartCategory };
