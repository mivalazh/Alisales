import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { parseBodyType } from '../apps/web/lib/browse';
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
 *    description, which the local fuzzy predicate does not read) would sink;
 *  - the answer is the whole pool, paged past the RPC's 100-row clamp, because
 *    the grid must not stop at the 48 rows a page render carries.
 */

const searchPublicListings = vi.hoisted(() => vi.fn());
const searchPublicListingsPage = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/listings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data/listings')>();
  return { ...actual, searchPublicListings, searchPublicListingsPage };
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

const DEFAULT_PART = {
  title: 'لنت ترمز جلو',
  category: 'brake',
  origin: 'oem',
  condition: 'new',
  partNumber: null,
  compatibility: 'پراید',
  warranty: null,
} as const;

function partCard(overrides: Partial<ListingCardData> = {}): ListingCardData {
  return {
    ...card({ kind: 'part' } as Partial<ListingCardData>),
    ...overrides,
    part: { ...DEFAULT_PART, ...(overrides.part ?? {}) },
  } as ListingCardData;
}

function load(query: string, ip?: string): Promise<Response> {
  return import('../apps/web/app/api/listings/search/route').then(({ GET }) =>
    GET(
      new Request(`https://alisales.ir/api/listings/search?${query}`, {
        headers: ip ? { 'x-forwarded-for': ip } : undefined,
      }),
    ),
  );
}

/** What the grid's fetch sees: the canonical redirect is followed, like fetch. */
async function get(query: string, ip?: string): Promise<Response> {
  const first = await load(query, ip);
  if (first.status !== 308) return first;
  const location = new URL(first.headers.get('location')!, 'https://alisales.ir');
  return load(location.search.slice(1), ip);
}

beforeEach(() => {
  searchPublicListings.mockReset();
  searchPublicListingsPage.mockReset();
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
    expect(await response.json()).toEqual({ rows: [], nextCursor: null });
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
    expect(searchPublicListings).toHaveBeenCalledWith(DEFAULT_FILTERS, undefined, {
      limit: 100,
      offset: 0,
    });
  });

  it('keeps paging past the 48-row render until a short page ends the pool', async () => {
    searchPublicListings
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => card({ id: `row-${i}` })))
      .mockResolvedValueOnce([card({ id: 'last' })]);

    const body = (await (await get('brand=toyota')).json()) as { rows: ListingCardData[] };

    expect(body.rows).toHaveLength(101);
    expect(body.rows.at(-1)?.id).toBe('last');
    expect(searchPublicListings.mock.calls.map((call) => call[2])).toEqual([
      { limit: 100, offset: 0 },
      { limit: 100, offset: 100 },
    ]);
  });

  it('stops at the response ceiling when every page is full', async () => {
    searchPublicListings.mockResolvedValue(
      Array.from({ length: 100 }, (_, i) => card({ id: `row-${i}` })),
    );

    const body = (await (await get('')).json()) as { rows: ListingCardData[] };

    expect(body.rows).toHaveLength(1_000);
    expect(searchPublicListings).toHaveBeenCalledTimes(10);
  });

  it('narrows a body group across pages instead of returning the unfiltered prefix', async () => {
    searchPublicListings
      .mockResolvedValueOnce(Array.from({ length: 100 }, (_, i) => card({ id: `sedan-${i}`, model: 'camry' })))
      .mockResolvedValueOnce([card({ id: 'suv', model: 'land cruiser' })]);

    const body = (await (await get('body=suv')).json()) as { rows: ListingCardData[] };

    // Only the SUV matches; the 100 sedans are dropped, and the walk continued.
    expect(body.rows.map((row) => row.id)).toEqual(['suv']);
    expect(searchPublicListings.mock.calls.map((call) => call[2])).toEqual([
      { limit: 100, offset: 0 },
      { limit: 100, offset: 100 },
    ]);
  });

  it('pages a curated body group through the RPC instead of walking the pool', async () => {
    searchPublicListingsPage.mockResolvedValue({
      rows: [card({ id: 'suv', model: 'land cruiser' })],
      nextCursor: 'next-group-page',
    });

    const body = (await (await get('body=suv&limit=2')).json()) as {
      rows: ListingCardData[];
      nextCursor: string | null;
    };

    expect(searchPublicListings).not.toHaveBeenCalled();
    const [filters, category, page, options] = searchPublicListingsPage.mock.calls[0];
    expect(filters).toEqual(DEFAULT_FILTERS);
    expect(category).toBeUndefined();
    expect(page).toEqual({ limit: 2, cursor: null });
    // The keywords are the shared table's, not the URL's.
    expect(options.bodyKeywords).toEqual(parseBodyType('suv')!.keywords);
    expect(body.nextCursor).toBe('next-group-page');
  });

  it('never trusts keywords sent by the client', async () => {
    searchPublicListingsPage.mockResolvedValue({ rows: [], nextCursor: null });

    await get('body=suv&bodyKeywords=camry&bodyKeywords=motorcycle&limit=2');

    const options = searchPublicListingsPage.mock.calls[0][3];
    expect(options.bodyKeywords).toEqual(parseBodyType('suv')!.keywords);
    expect(options.bodyKeywords).not.toContain('camry');
  });

  it('passes a curated cursor straight back to the paged read', async () => {
    searchPublicListingsPage.mockResolvedValue({ rows: [], nextCursor: null });

    await get('body=hatchback&limit=2&cursor=opaque-page');

    expect(searchPublicListingsPage.mock.calls[0][2]).toEqual({
      limit: 2,
      cursor: 'opaque-page',
    });
  });

  it('sends no body predicate for a group key it does not know', async () => {
    searchPublicListingsPage.mockResolvedValue({ rows: [], nextCursor: null });

    await get('body=spaceship&limit=2');

    expect(searchPublicListingsPage.mock.calls[0][3]).toEqual({ bodyKeywords: undefined });
  });

  it('scopes ?kind=part to parts', async () => {
    searchPublicListings.mockResolvedValue([
      card({ id: 'car', model: 'camry' }),
      partCard({ id: 'brake' }),
    ]);

    const body = (await (await get('kind=part')).json()) as { rows: ListingCardData[] };

    expect(body.rows.map((row) => row.id)).toEqual(['brake']);
  });

  it('scopes parts attributes from the URL', async () => {
    searchPublicListings.mockResolvedValue([
      card({ id: 'car' }),
      partCard({ id: 'oem-brake', part: { ...DEFAULT_PART, origin: 'oem' } }),
      partCard({ id: 'aftermarket-brake', part: { ...DEFAULT_PART, origin: 'aftermarket' } }),
    ]);

    const origin = (await (await get('origin=oem')).json()) as { rows: ListingCardData[] };
    expect(origin.rows.map((row) => row.id)).toEqual(['oem-brake']);

    const category = (await (await get('category=brake')).json()) as { rows: ListingCardData[] };
    expect(category.rows.map((row) => row.id)).toEqual(['oem-brake', 'aftermarket-brake']);
  });

  it('answers 503 without caching when the read throws', async () => {
    searchPublicListings.mockRejectedValue(new Error('postgrest down'));

    const response = await get('q=patrol');

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toHaveProperty('error');
  });

  it('canonicalises the cache key: sorted params, utm_* dropped, no read', async () => {
    const response = await load('priceTo=500&utm_source=telegram&brand=toyota&utm_medium=cpc');

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/api/listings/search?brand=toyota&priceTo=500');
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=300');
    expect(searchPublicListings).not.toHaveBeenCalled();
  });

  it('preserves first-value-wins when repeated keys are canonicalised', async () => {
    searchPublicListings.mockResolvedValue([]);

    const redirect = await load('brand=toyota,bmw&brand=ford&kind=vehicle');
    expect(redirect.headers.get('location')).toBe(
      '/api/listings/search?brand=toyota%2Cbmw&brand=ford&kind=vehicle',
    );

    await get('brand=toyota,bmw&brand=ford&kind=vehicle');
    const filters = searchPublicListings.mock.calls[0]?.[0];
    expect(filters?.brand).toEqual(['toyota', 'bmw']);
  });

  it('drops utm_* even when the rest of the query is already canonical', async () => {
    searchPublicListings.mockResolvedValue([]);

    const response = await load('brand=toyota&utm_campaign=spring');

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/api/listings/search?brand=toyota');
  });

  it('answers a canonical URL directly, with rate-limit headers', async () => {
    searchPublicListings.mockResolvedValue([]);

    const response = await get('brand=toyota&priceTo=500');

    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('120');
    expect(Number(response.headers.get('X-RateLimit-Remaining'))).toBeGreaterThanOrEqual(0);
  });

  it('rate-limits an address that floods the pool read', async () => {
    searchPublicListings.mockResolvedValue([]);
    const { SEARCH_RATE_LIMIT } = await import('../apps/web/app/api/listings/search/route');
    const ip = '203.0.113.99';

    for (let i = 0; i < SEARCH_RATE_LIMIT.limit; i += 1) {
      expect((await get('brand=toyota', ip)).status, `request ${i + 1}`).toBe(200);
    }

    const blocked = await get('brand=toyota', ip);

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
    expect(blocked.headers.get('Cache-Control')).toBe('no-store');
    expect(blocked.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(await blocked.json()).toHaveProperty('error');
  });
});

/**
 * Paging is opt-in on the wire: the first page must carry `limit`, and its
 * answer carries the cursor for the next. A request with neither keeps the
 * older whole-pool answer, and curated narrowing always takes that path because
 * it is applied to rows after the read.
 */
describe('/api/listings/search · keyset pages', () => {
  it('returns one page and its cursor when limit is asked for', async () => {
    const pageRows = [card({ id: 'page-1' }), card({ id: 'page-2' })];
    searchPublicListingsPage.mockResolvedValue({ rows: pageRows, nextCursor: 'cursor-2' });

    const response = await get('brand=toyota&limit=2');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows: pageRows, nextCursor: 'cursor-2' });
    expect(searchPublicListingsPage).toHaveBeenCalledWith(
      expect.objectContaining({ brand: ['toyota'] }),
      undefined,
      { limit: 2, cursor: null },
      { bodyKeywords: undefined },
    );
    expect(searchPublicListings).not.toHaveBeenCalled();
  });

  it('passes the cursor through and clamps an oversized limit', async () => {
    searchPublicListingsPage.mockResolvedValue({ rows: [], nextCursor: null });

    await get('cursor=cursor-2&limit=500');

    expect(searchPublicListingsPage).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      { limit: 100, cursor: 'cursor-2' },
      { bodyKeywords: undefined },
    );
  });

  it('keeps the whole-pool answer for a request that does not page', async () => {
    const pool = [card({ id: 'pool-1' })];
    searchPublicListings.mockResolvedValue(pool);

    const response = await get('brand=toyota');

    expect(await response.json()).toEqual({ rows: pool, nextCursor: null });
    expect(searchPublicListingsPage).not.toHaveBeenCalled();
  });

  it('keeps the whole-pool answer for narrowing that has no SQL predicate', async () => {
    // `?kind=part` is applied to rows after the read: paging before narrowing
    // would skip matches that fall on a later page. `?body=` used to be in this
    // group and is now pushed into the RPC (0023) instead.
    const pool = [card({ id: 'pool-1' })];
    searchPublicListings.mockResolvedValue(pool);

    const response = await get('kind=vehicle&limit=2');
    const body = (await response.json()) as { rows: unknown[]; nextCursor: unknown };

    expect(response.status).toBe(200);
    expect(Array.isArray(body.rows)).toBe(true);
    expect(body.nextCursor).toBeNull();
    expect(searchPublicListings).toHaveBeenCalled();
    expect(searchPublicListingsPage).not.toHaveBeenCalled();
  });
});
