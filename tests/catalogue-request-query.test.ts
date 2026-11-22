import { describe, expect, it } from 'vitest';
import type { ListingCardData } from '../apps/web/lib/data/listings';
import {
  catalogueExtras,
  catalogueRequestQuery,
  catalogueState,
  narrowExtras,
} from '../apps/web/lib/catalogue';

const params = (query: string) => new URLSearchParams(query);

/** The request the hook would send for a URL. */
function request(query: string, category?: 'car' | 'motorcycle' | 'heavy'): URLSearchParams {
  return new URLSearchParams(catalogueRequestQuery(catalogueState(params(query)), category));
}

/**
 * `?body=`, `?kind=` and the parts attributes narrow the grid but are not
 * `SearchFilters` columns. They used to be client-side only, which meant these
 * URLs sent the same request as the unfiltered page and could only ever narrow
 * whatever that request returned. They now key the request.
 */
describe('catalogueRequestQuery', () => {
  it('keys the request on the extra narrowing, keeping the shared filters', () => {
    const query = request(
      'body=suv&kind=part&origin=oem&warranty=1&compat=پراید&pcond=new&brand=toyota&sort=priceAsc&utm_source=x',
    );

    expect(query.get('body')).toBe('suv');
    expect(query.get('kind')).toBe('part');
    expect(query.get('origin')).toBe('oem');
    expect(query.get('warranty')).toBe('1');
    expect(query.get('compat')).toBe('پراید');
    expect(query.get('pcond')).toBe('new');
    expect(query.get('brand')).toBe('toyota');
    // Sorting is the grid's job; campaign params are not catalogue state.
    expect(query.get('sort')).toBeNull();
    expect(query.get('utm_source')).toBeNull();
  });

  it('keeps the vehicle category and carries a parts category in the same key', () => {
    expect(request('body=suv', 'car').get('category')).toBe('car');
    expect(request('category=brake&origin=oem').get('category')).toBe('brake');
    // An unknown category is not forwarded, exactly like the route ignores it.
    expect(request('category=plane').has('category')).toBe(false);
  });

  it('builds the same request for the same URL, so the hook can key on it', () => {
    expect(catalogueRequestQuery(catalogueState(params('body=suv&brand=bmw')))).toBe(
      catalogueRequestQuery(catalogueState(params('body=suv&brand=bmw'))),
    );
    expect(catalogueRequestQuery(catalogueState(params('body=suv')))).not.toBe(
      catalogueRequestQuery(catalogueState(params(''))),
    );
  });

  it('ignores values the parser rejects', () => {
    const query = request('kind=parts&body=spaceship&warranty=0&origin=');

    expect(query.toString()).toBe('');
  });
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
    ...overrides,
  } as unknown as ListingCardData;
}

describe('narrowExtras', () => {
  it('leaves rows untouched when the URL has no extra narrowing', () => {
    const rows = [card({ id: 'a' })];
    expect(narrowExtras(rows, catalogueExtras(params('brand=toyota')))).toEqual(rows);
  });

  it('applies body groups to vehicles and parts attributes to parts', () => {
    const rows = [
      card({ id: 'suv', model: 'land cruiser' }),
      card({ id: 'sedan', model: 'camry' }),
      card({ id: 'part', kind: 'part', part: { category: 'brake', origin: 'oem' } as never }),
    ];

    expect(narrowExtras(rows, catalogueExtras(params('body=suv'))).map((row) => row.id)).toEqual([
      'suv',
    ]);
    expect(narrowExtras(rows, catalogueExtras(params('origin=oem'))).map((row) => row.id)).toEqual([
      'part',
    ]);
    expect(narrowExtras(rows, catalogueExtras(params('kind=part'))).map((row) => row.id)).toEqual([
      'part',
    ]);
  });
});
