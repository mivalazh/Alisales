import { describe, expect, it } from 'vitest';
import {
  FREE_THIRD_LISTING_MESSAGE,
  activeListingCount,
  countsTowardFreeLimit,
  freeLimitDecision,
} from '../src/listing-limit';

describe('countsTowardFreeLimit', () => {
  it('counts only active listings', () => {
    expect(countsTowardFreeLimit('active')).toBe(true);
  });

  it('never counts sold, archived (paused), expired, drafts or rejected listings', () => {
    for (const state of ['sold', 'paused', 'expired', 'draft', 'rejected'] as const) {
      expect(countsTowardFreeLimit(state)).toBe(false);
    }
  });
});

describe('activeListingCount', () => {
  it('counts only active states in the mix', () => {
    expect(activeListingCount(['active', 'active', 'sold', 'paused', 'expired'])).toBe(2);
    expect(activeListingCount(['paused', 'sold'])).toBe(0);
    expect(activeListingCount([])).toBe(0);
  });
});

describe('freeLimitDecision', () => {
  it('allows the first listing with one slot left', () => {
    expect(freeLimitDecision(0)).toEqual({ allowed: true, message: null, remaining: 2 });
    expect(freeLimitDecision(1)).toEqual({ allowed: true, message: null, remaining: 1 });
  });

  it('blocks the third active listing with the exact C6 message', () => {
    const decision = freeLimitDecision(2);
    expect(decision.allowed).toBe(false);
    expect(decision.message).toBe('برای آگهی سوم، پلن انتخاب کن.');
    expect(decision.message).toBe(FREE_THIRD_LISTING_MESSAGE);
    expect(decision.remaining).toBe(0);
  });

  it('stays blocked beyond the limit and never reports negative slots', () => {
    expect(freeLimitDecision(5).allowed).toBe(false);
    expect(freeLimitDecision(5).remaining).toBe(0);
  });

  it('honours a custom limit', () => {
    expect(freeLimitDecision(10, 10).allowed).toBe(false);
    expect(freeLimitDecision(9, 10).remaining).toBe(1);
  });
});
