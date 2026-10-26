import { describe, expect, it } from 'vitest';
import { CITIES, citySlugs } from '../src/vehicle';
import { DEFAULT_CITY, featureFlags, selectableCities } from '../src/features';

describe('city catalog (complete — the flag decides what users pick)', () => {
  it('ships the full launch catalog with Kish first', () => {
    expect(CITIES).toHaveLength(11);
    expect(CITIES[0].slug).toBe('kish');
    expect(new Set(citySlugs).size).toBe(CITIES.length);
    for (const c of CITIES) expect(c.label.length).toBeGreaterThan(0);
  });

  it('maps Kish to its reference.gov.ir county id (null elsewhere)', () => {
    expect(CITIES.find((c) => c.slug === 'kish')?.countyId).toBe('1220003');
    for (const c of CITIES.filter((c) => c.slug !== 'kish')) expect(c.countyId).toBeNull();
  });
});

describe('feature flags (one source shared by web + mobile)', () => {
  it('ships city_selection off at Kish launch', () => {
    expect(featureFlags.city_selection).toBe(false);
    expect(DEFAULT_CITY).toBe('kish');
  });

  it('offers only Kish while the flag is off, the full catalog while on', () => {
    expect(selectableCities().map((c) => c.slug)).toEqual(['kish']);
    expect(selectableCities(false).map((c) => c.slug)).toEqual(['kish']);
    expect(selectableCities(true)).toHaveLength(CITIES.length);
  });

  it('never returns a city outside the catalog', () => {
    for (const flag of [false, true]) {
      for (const c of selectableCities(flag)) expect(citySlugs).toContain(c.slug);
    }
  });
});
