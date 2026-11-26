import { describe, expect, it } from 'vitest';
import { filterPartsByAttributes, parsePartCategory } from './browse';
import type { ListingCardData } from './data/listings';

function part(overrides: Partial<ListingCardData> = {}): ListingCardData {
  return {
    id: 'p1',
    slug: 'p1',
    sellerId: 's1',
    priceIRR: 1_000_000,
    city: 'kish',
    state: 'active',
    featured: false,
    publishedAt: null,
    hasReport: false,
    brand: '',
    model: 'کیت ترمز',
    trim: null,
    year: 0,
    mileageKm: 0,
    gearbox: 'automatic',
    fuel: 'petrol',
    color: 'silver',
    condition: 'new',
    plateType: 'unplated',
    coverUrl: '/covers/photos/cayenne-brake-kit-part-thumb.webp',
    photos: ['/covers/photos/cayenne-brake-kit-part.webp'],
    showroomName: null,
    showroomVerified: false,
    allowPhoneReveal: true,
    kind: 'part',
    part: {
      title: 'کیت ترمز',
      category: 'brake',
      origin: 'original',
      condition: 'new',
      partNumber: null,
      compatibility: 'پورشه کاین',
      warranty: '۶ ماه',
    },
    ...overrides,
  };
}

describe('filterPartsByAttributes', () => {
  it('filters by origin, warranty and compatibility text', () => {
    const pool = [
      part(),
      part({
        id: 'p2',
        slug: 'p2',
        part: {
          title: 'توربو',
          category: 'engine',
          origin: 'commercial',
          condition: 'used',
          partNumber: null,
          compatibility: 'BMW X5',
          warranty: null,
        },
      }),
    ];

    expect(filterPartsByAttributes(pool, { origin: 'original' }).map((l) => l.slug)).toEqual(['p1']);
    expect(filterPartsByAttributes(pool, { warrantyOnly: true }).map((l) => l.slug)).toEqual(['p1']);
    expect(filterPartsByAttributes(pool, { compatibility: 'بی ام' })).toHaveLength(0);
    expect(filterPartsByAttributes(pool, { compatibility: 'bmw' }).map((l) => l.slug)).toEqual(['p2']);
  });

  it('never returns a vehicle even when it matches the text', () => {
    const vehicle = part({ id: 'v1', slug: 'v1', kind: 'vehicle', part: null });
    expect(filterPartsByAttributes([vehicle], {})).toHaveLength(0);
  });

  it('parses only known part categories from the URL', () => {
    expect(parsePartCategory('brake')).toBe('brake');
    expect(parsePartCategory('engines')).toBeNull();
  });
});
