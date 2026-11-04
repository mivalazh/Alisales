import { describe, expect, it } from 'vitest';
import { filterPartsByAttributes, parsePartCategory } from './browse';
import { storiesFrom } from './stories';
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

describe('parts story rail', () => {
  it('shows parts only, with approved stories pinned first', () => {
    const vehicle = part({ id: 'v1', slug: 'v1', kind: 'vehicle', part: null });
    const pool = [part({ slug: 'a' }), part({ slug: 'b' }), part({ slug: 'c' }), vehicle];

    const stories = storiesFrom(pool, ['c'], ['a'], 3);
    expect(stories.map((s) => s.slug)).toEqual(['c', 'a', 'b']);
    expect(stories.every((s) => s.href.startsWith('/listing/'))).toBe(true);
    expect(stories.some((s) => s.slug === 'v1')).toBe(false);
  });

  it('skips listings without a cover and never repeats one', () => {
    const pool = [
      part({ slug: 'a', coverUrl: null }),
      part({ slug: 'b' }),
      part({ slug: 'b' }),
    ];
    expect(storiesFrom(pool, ['b'], ['b'], 6).map((s) => s.slug)).toEqual(['b']);
  });
});
