import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLANS,
  FREE_LISTING_LIMIT,
  canCreateListing,
  remainingSlots,
} from '../src/subscription';

/**
 * These tests lock the legally-reviewed pricing/limits.
 * Changing them requires legal/finance sign-off (see README → Legal gates).
 */
describe('pricing gate (locked values)', () => {
  it('individuals get exactly 2 free concurrent listings', () => {
    expect(FREE_LISTING_LIMIT).toBe(2);
    expect(DEFAULT_PLANS.free.listingLimit).toBe(2);
    expect(DEFAULT_PLANS.free.priceIRR).toBe(0);
  });

  it('Basic = 8,000,000 IRR/mo → 10 listings, 1 featured, 1 inspection, priority 1', () => {
    const p = DEFAULT_PLANS.basic;
    expect(p.priceIRR).toBe(8_000_000);
    expect(p.listingLimit).toBe(10);
    expect(p.featuredSlots).toBe(1);
    expect(p.freeInspectionsPerMonth).toBe(1);
    expect(p.searchPriority).toBe(1);
  });

  it('Pro = 20,000,000 IRR/mo → 40 listings, 5 featured, 3 inspections, priority 2', () => {
    const p = DEFAULT_PLANS.pro;
    expect(p.priceIRR).toBe(20_000_000);
    expect(p.listingLimit).toBe(40);
    expect(p.featuredSlots).toBe(5);
    expect(p.freeInspectionsPerMonth).toBe(3);
    expect(p.searchPriority).toBe(2);
  });

  it('has no fourth plan', () => {
    expect(Object.keys(DEFAULT_PLANS).sort()).toEqual(['basic', 'free', 'pro']);
  });
});

describe('slot enforcement helpers', () => {
  it('blocks the 3rd free listing', () => {
    expect(canCreateListing({ plan: DEFAULT_PLANS.free, usedSlots: 1 })).toBe(true);
    expect(canCreateListing({ plan: DEFAULT_PLANS.free, usedSlots: 2 })).toBe(false);
  });

  it('enforces paid plan limits', () => {
    expect(canCreateListing({ plan: DEFAULT_PLANS.basic, usedSlots: 9 })).toBe(true);
    expect(canCreateListing({ plan: DEFAULT_PLANS.basic, usedSlots: 10 })).toBe(false);
    expect(canCreateListing({ plan: DEFAULT_PLANS.pro, usedSlots: 40 })).toBe(false);
  });

  it('remaining slots never go negative', () => {
    expect(remainingSlots(DEFAULT_PLANS.free, 5)).toBe(0);
    expect(remainingSlots(DEFAULT_PLANS.basic, 4)).toBe(6);
  });
});
