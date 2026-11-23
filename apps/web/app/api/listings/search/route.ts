import { NextResponse } from 'next/server';
import { vehicleCategories, type VehicleCategory } from '@alisales/schemas';
import {
  canonicalSearchQuery,
  catalogueState,
  narrowExtras,
  type CatalogueState,
} from '@/lib/catalogue';
import { searchPublicListings, type ListingCardData } from '@/lib/data/listings';
import { rateLimit } from '@/lib/security/rate-limit';

/**
 * GET /api/listings/search?<catalogue filters>[&category=car|motorcycle|heavy]
 *
 * The whole public catalogue for a URL — filters or not.
 *
 * The catalogue pages are static: their HTML carries 48 cards for an instant,
 * cacheable first paint, but that render is only the newest rows. A brand,
 * price or query matching row 49 used to look empty, and the unfiltered grid
 * could not show inventory past row 48 at all. After hydration the shells ask
 * this route and swap the rendered rows for the full matching pool — the same
 * RPC, filters, ranking and seeded fallback the page itself uses.
 *
 * The shared read pages 100 rows at a time (the RPC's own clamp) until a short
 * page ends the walk. `POOL_MAX` bounds what one response can carry; it is a
 * guard against a pathological catalogue, not a product limit.
 *
 * The URL is parsed by `catalogueState` — the exact call the shells make on
 * `useSearchParams()` — so a chip can never mean one thing here and another in
 * the grid, down to first-value-wins on a repeated key. Rows come back in
 * the read's own order: `searchPublicListings` already ranks a `q` on both the
 * hosted and the seeded path, and re-ranking here would overwrite that order
 * with a narrower scorer (a description-only server hit scores zero locally).
 *
 * Narrowing that has no `SearchFilters` column — `?body=` (a curated model
 * group), `?kind=` (vehicle/part) and the parts attributes `origin`, `warranty`,
 * `compat`, `pcond` — is applied to each page *before* the walk continues, so a
 * matching row past the first page is still part of "the full matching set"
 * instead of being cut off by the unfiltered prefix. `POOL_SCAN_MAX` bounds the
 * scan; `POOL_MAX` bounds what the response carries.
 *
 * Public data only — no cookie, no session — so the response is safe to cache
 * per URL at the edge.
 *
 * Because the cache key is the URL, the query is canonicalised first: sorted,
 * with marketing parameters (`utm_*`) dropped. `?brand=toyota&priceTo=500` and
 * `?priceTo=500&utm_source=telegram&brand=toyota` are one view, so they must be
 * one cache entry instead of three. A non-canonical request answers with a
 * cacheable 308 to the canonical URL before any read runs.
 *
 * Reading the pool is the most expensive public work in the app (up to ten RPC
 * pages per request), so anonymous callers are rate-limited per address. This
 * is a flood brake, not a product limit: a buyer changes a filter at human
 * speed, and the 30s edge cache absorbs repeat views.
 */
const POOL_PAGE = 100;
const POOL_MAX = 1_000;
const POOL_SCAN_MAX = 5_000;

/** Flood brake for anonymous catalogue reads (per client address, per minute). */
export const SEARCH_RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const;

async function readPool(
  state: CatalogueState,
  category: VehicleCategory | undefined,
): Promise<ListingCardData[]> {
  const rows: ListingCardData[] = [];
  for (let offset = 0; offset < POOL_SCAN_MAX; offset += POOL_PAGE) {
    const page = await searchPublicListings(state.filters, category, {
      limit: POOL_PAGE,
      offset,
    });
    rows.push(...narrowExtras(page, state.extras));
    // Stop on a short page (the pool ended) or once enough matches are in hand.
    if (page.length < POOL_PAGE || rows.length >= POOL_MAX) break;
  }
  return rows.slice(0, POOL_MAX);
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);

  // One cache entry per view: redirect before parsing or reading, and cache the
  // mapping itself — it never changes and it is cheaper than a cache miss.
  const canonical = canonicalSearchQuery(url.searchParams);
  if (url.search.slice(1) !== canonical) {
    return new NextResponse(null, {
      status: 308,
      headers: {
        Location: `${url.pathname}${canonical ? `?${canonical}` : ''}`,
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  }

  const limited = rateLimit({
    request,
    bucket: 'catalogue-search',
    limit: SEARCH_RATE_LIMIT.limit,
    windowMs: SEARCH_RATE_LIMIT.windowMs,
  });
  const limitHeaders = {
    'X-RateLimit-Limit': String(limited.limit),
    'X-RateLimit-Remaining': String(limited.remaining),
  };
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'تعداد درخواست‌ها بیش از حد مجاز است؛ لحظه‌ای بعد تلاش کنید.' },
      {
        status: 429,
        headers: {
          ...limitHeaders,
          'Retry-After': String(limited.retryAfterSeconds),
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const state = catalogueState(url.searchParams);
  const raw = url.searchParams.get('category');
  // A parts category (`?category=engine`) travels in the same key; it scopes
  // through `extras.partCategory` instead of the vehicle category.
  const category = (vehicleCategories as readonly string[]).includes(raw ?? '')
    ? (raw as VehicleCategory)
    : undefined;

  try {
    const rows = await readPool(state, category);
    return NextResponse.json(
      { rows },
      {
        headers: {
          ...limitHeaders,
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      },
    );
  } catch (error) {
    console.warn('[alisales] catalogue search request failed:', error);
    return NextResponse.json(
      { error: 'کاتالوگ در دسترس نیست؛ دوباره تلاش کنید.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
