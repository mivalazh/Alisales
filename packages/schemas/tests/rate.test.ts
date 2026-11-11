import { describe, expect, it } from 'vitest';
import {
  AED_PER_USD,
  isPlausibleAedRate,
  isPlausibleAedRateToman,
} from '../src/rate';

describe('AED rate sanity window', () => {
  it('accepts the current Tether-derived dirham quote', () => {
    const usdtRial = 2_628_010;
    const aedToman = usdtRial / 10 / AED_PER_USD;
    expect(Math.round(aedToman)).toBe(71_559);
    expect(isPlausibleAedRateToman(aedToman)).toBe(true);
    expect(isPlausibleAedRate(Math.round(aedToman) * 10)).toBe(true);
  });

  it('still rejects impossible and stale values', () => {
    expect(isPlausibleAedRateToman(0)).toBe(false);
    expect(isPlausibleAedRateToman(Number.NaN)).toBe(false);
    expect(isPlausibleAedRateToman(14_999)).toBe(false);
    expect(isPlausibleAedRateToman(120_001)).toBe(false);
    expect(isPlausibleAedRate(2_000_000)).toBe(false);
  });
});
