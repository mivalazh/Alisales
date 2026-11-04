import { describe, expect, it } from 'vitest';
import { mergeMyListings } from './my-listings-cookie';
import type { ListingCardData } from './listings';

function card(slug: string): ListingCardData {
  return {
    id: slug,
    slug,
    sellerId: 's1',
    priceIRR: 1,
    city: 'kish',
    state: 'active',
    featured: false,
    publishedAt: null,
    hasReport: false,
    brand: 'toyota',
    model: 'Land Cruiser',
    trim: null,
    year: 1402,
    mileageKm: 0,
    gearbox: 'automatic',
    fuel: 'petrol',
    color: 'white',
    condition: 'new',
    plateType: 'kish',
    coverUrl: null,
    showroomName: null,
    showroomVerified: false,
    allowPhoneReveal: false,
  };
}

describe('mergeMyListings', () => {
  it('puts the seller’s fresh publishes first without duplicating the feed', () => {
    const merged = mergeMyListings([card('mine')], [card('mine'), card('other')]);
    expect(merged.map((l) => l.slug)).toEqual(['mine', 'other']);
  });

  it('returns the feed untouched when the snapshot is empty', () => {
    expect(mergeMyListings([], [card('a')]).map((l) => l.slug)).toEqual(['a']);
  });

  it('keeps both sides when they do not overlap', () => {
    expect(mergeMyListings([card('a')], [card('b')]).map((l) => l.slug)).toEqual(['a', 'b']);
  });
});
