import { NextResponse } from 'next/server';
import {
  vehicleCategories,
  type SearchFilters,
  type VehicleCategory,
} from '@alisales/schemas';
import { filtersFromParams } from '@/lib/catalogue';
import { searchPublicListings, type ListingCardData } from '@/lib/data/listings';

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
 * The URL is parsed by `filtersFromParams` — the exact function the shells call
 * on `useSearchParams()` — so a chip can never mean one thing here and another
 * in the grid, down to first-value-wins on a repeated key. Rows come back in
 * the read's own order: `searchPublicListings` already ranks a `q` on both the
 * hosted and the seeded path, and re-ranking here would overwrite that order
 * with a narrower scorer (a description-only server hit scores zero locally).
 *
 * Public data only — no cookie, no session — so the response is safe to cache
 * per URL at the edge.
 */
const POOL_PAGE = 100;
const POOL_MAX = 1_000;

async function readPool(
  filters: SearchFilters,
  category: VehicleCategory | undefined,
): Promise<ListingCardData[]> {
  const rows: ListingCardData[] = [];
  for (let offset = 0; offset < POOL_MAX; offset += POOL_PAGE) {
    const page = await searchPublicListings(filters, category, { limit: POOL_PAGE, offset });
    rows.push(...page);
    if (page.length < POOL_PAGE) break;
  }
  return rows;
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const filters = filtersFromParams(url.searchParams);
  const raw = url.searchParams.get('category');
  const category = (vehicleCategories as readonly string[]).includes(raw ?? '')
    ? (raw as VehicleCategory)
    : undefined;

  try {
    const rows = await readPool(filters, category);
    return NextResponse.json(
      { rows },
      {
        headers: {
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
