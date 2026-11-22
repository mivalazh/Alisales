import { NextResponse } from 'next/server';
import { vehicleCategories, type VehicleCategory } from '@alisales/schemas';
import { filtersFromParams } from '@/lib/catalogue';
import { searchPublicListings } from '@/lib/data/listings';

/**
 * GET /api/listings/search?<catalogue filters>[&category=car|motorcycle|heavy]
 *
 * The filtered public catalogue for the browser shells.
 *
 * The catalogue pages are static: their HTML carries 48 cards for an instant,
 * cacheable first paint, but that pool is only the newest rows. A brand, price
 * or query that matches row 49 used to look empty once the shell narrowed the
 * rendered rows locally. When the URL carries filters the shell asks this route
 * instead, and the shared `searchPublicListings` read answers with the real
 * matches — the same RPC, filters and seeded fallback the page itself uses.
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
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const filters = filtersFromParams(url.searchParams);
  const raw = url.searchParams.get('category');
  const category = (vehicleCategories as readonly string[]).includes(raw ?? '')
    ? (raw as VehicleCategory)
    : undefined;

  try {
    const rows = await searchPublicListings(filters, category);
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
