import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import type { ListingCardData } from '../apps/web/lib/data/listings';

/**
 * The catalogue shells fetch `/api/listings/search` when the URL carries
 * filters, so this route decides what a filtered catalogue contains. Two
 * things must hold:
 *
 *  - the URL is parsed with the shared codec (`brand=a,b`, Persian digits,
 *    first value wins, …), so the route and the page can never disagree about
 *    a filter;
 *  - the read's rows leave untouched, in the read's order. `searchPublicListings`
 *    ranks a `q` on both data paths; re-ranking here would overwrite that order
 *    with a narrower scorer, and rows the *server* matched (for example on the
 *    description, which the local fuzzy predicate does not read) would sink.
 */

const searchPublicListings = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/listings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/listings')>();
  return { ...actual, searchPublicListings };
});

function card(overrides: Partial<ListingCardData> = {}): ListingCardData {
  return {
    id: 'id',
    slug: 'slug',
    sellerId: 'seller',
    priceIRR: 1_000_000,
    city: 'kish',
    state: 'active',
    featured: false,
    publishedAt: '2026-01-01T00:00:00.000Z',
    hasReport: false,
    brand: 'toyota',
    model: 'camry',
    trim: null,
    year: 2022,
    mileageKm: 10_000,
    gearbox: 'automatic',
    fuel: 'petrol',
    color: 'white',
    condition: 'used',
    plateType: 'kish',
    coverUrl: null,
    showroomName: null,
    showroomVerified: false,
    allowPhoneReveal: false,
    ...(overrides as ListingCardData),
  } as unknown as ListingCardData;
}

function get(query: string): Promise<Response> {
  return import('../apps/web/app/api/listings/search/route').then(({ GET }) =>
    GET(new Request(`https://alisales.ir/api/listings/search?${query}`)),
  );
}

beforeEach(() => {
  searchPublicListings.mockReset();
});

describe('/api/listings/search', () => {
  it('parses the URL with the shared codec and passes the vehicle category', async () => {
    searchPublicListings.mockResolvedValue([]);

    const response = await get(
      'q=land+cruiser&brand=toyota,bmw&brand=ford&priceTo=۵۰۰&category=motorcycle&sort=priceAsc&body=suv&kind=vehicle',
    );

    expect(response.status).toBe(200);
    const [filters, category] = searchPublicListings.mock.calls[0];
    // First value wins, exactly like `filtersFromParams` in the grid.
    expect(filters.brand).toEqual(['toyota', 'bmw']);
    expect(filters.priceTo).toBe(500); // Persian digits, exactly like the page
    expect(filters.q).toBe('land cruiser');
    expect(category).toBe('motorcycle');
    expect(await response.json()).toEqual({ rows: [] });
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=30');
  });

  it('returns the read\'s ranked rows untouched, including server-only matches', async () => {
    // Exactly what `searchPublicListings` hands back for this q: relevance
    // bands with sold-last/recency inside each band. The third row was matched
    // by the read on a field the local predicate never sees.
    searchPublicListings.mockResolvedValue([
      card({ id: 'cruiser', model: 'land cruiser', publishedAt: '2026-01-01T00:00:00.000Z' }),
      card({ id: 'camry', model: 'camry', publishedAt: '2026-02-01T00:00:00.000Z' }),
      card({ id: 'prado', model: 'prado' }),
    ]);

    const body = (await (await get('q=land+cruiser')).json()) as { rows: ListingCardData[] };

    expect(body.rows.map((row) => row.id)).toEqual(['cruiser', 'camry', 'prado']);
  });

  it('ignores unknown filters and categories instead of failing the request', async () => {
    searchPublicListings.mockResolvedValue([]);

    const response = await get('yearFrom=soon&category=plane&nonsense=1');

    expect(response.status).toBe(200);
    expect(searchPublicListings).toHaveBeenCalledWith(DEFAULT_FILTERS, undefined);
  });

  it('answers 503 without caching when the read throws', async () => {
    searchPublicListings.mockRejectedValue(new Error('postgrest down'));

    const response = await get('q=patrol');

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toHaveProperty('error');
  });
});
