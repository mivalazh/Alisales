import { describe, expect, it } from 'vitest';
import {
  applyModeration,
  emptyModerationState,
  normalizeModerationState,
  overviewCounts,
} from './moderation-rules';
import type { ListingCardData } from './listings';

function card(overrides: Partial<ListingCardData> = {}): ListingCardData {
  return {
    id: 'listing-1',
    slug: 'listing-1',
    sellerId: 'seller-1',
    priceIRR: 1_000_000_000,
    city: 'kish',
    state: 'active',
    featured: false,
    publishedAt: '2026-10-01T00:00:00.000Z',
    hasReport: false,
    brand: 'toyota',
    model: 'Land Cruiser',
    trim: null,
    year: 2024,
    mileageKm: 1000,
    gearbox: 'automatic',
    fuel: 'petrol',
    color: 'white',
    condition: 'used',
    plateType: 'kish',
    coverUrl: '/cover.webp',
    showroomName: null,
    showroomVerified: false,
    allowPhoneReveal: true,
    kind: 'vehicle',
    part: null,
    ...overrides,
  };
}

describe('normalizeModerationState', () => {
  it('returns an empty state for missing or invalid input', () => {
    expect(normalizeModerationState(null)).toEqual(emptyModerationState());
    expect(normalizeModerationState({} as never)).toEqual(emptyModerationState());
  });

  it('keeps known decisions and drops unknown ones', () => {
    const state = normalizeModerationState({
      reports: { a: 'dismissed', b: 'nonsense' },
      verifications: { s1: 'approved' },
      stories: { slug: 'approved' },
      hidden: ['listing-9', 42],
    } as never);
    expect(state.reports).toEqual({ a: 'dismissed', b: 'open' });
    expect(state.verifications).toEqual({ s1: 'approved' });
    expect(state.stories).toEqual({ slug: 'approved' });
    expect(state.hidden).toEqual(['listing-9']);
  });
});

describe('applyModeration', () => {
  it('drops hidden listings', () => {
    const listings = [card({ id: 'keep' }), card({ id: 'gone' })];
    const result = applyModeration(listings, { hidden: ['gone'], verifiedSellers: new Set() });
    expect(result.map((l) => l.id)).toEqual(['keep']);
  });

  it('marks an approved seller’s listings as verified', () => {
    const result = applyModeration([card({ sellerId: 'seller-1' })], {
      hidden: [],
      verifiedSellers: new Set(['seller-1']),
    });
    expect(result[0]?.showroomVerified).toBe(true);
  });

  it('leaves other sellers and sold listings untouched', () => {
    const sold = card({ id: 'sold', sellerId: 'seller-2', state: 'sold' });
    const result = applyModeration([sold], {
      hidden: [],
      verifiedSellers: new Set(['seller-1']),
    });
    expect(result[0]).toEqual(sold);
  });

  it('accepts a Set or an array for hidden ids', () => {
    const listings = [card({ id: 'a' }), card({ id: 'b' })];
    expect(applyModeration(listings, { hidden: new Set(['a']), verifiedSellers: new Set() })).toHaveLength(1);
    expect(applyModeration(listings, { hidden: ['a'], verifiedSellers: new Set() })).toHaveLength(1);
  });
});

describe('overviewCounts', () => {
  it('splits vehicles from parts and counts sold separately', () => {
    const counts = overviewCounts([
      card({ id: '1', kind: 'vehicle' }),
      card({ id: '2', kind: 'vehicle' }),
      card({ id: '3', kind: 'part' }),
      card({ id: '4', kind: 'vehicle', state: 'sold' }),
      card({ id: '5', kind: 'part', state: 'paused' }),
    ]);
    expect(counts).toEqual({ activeVehicles: 2, activeParts: 1, sold: 1 });
  });
});
