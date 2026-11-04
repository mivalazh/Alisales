import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { countMatches, matchesFilters } from './filter-match';

const car = {
  city: 'kish',
  brand: 'nissan',
  model: 'Patrol',
  trim: 'Platinum',
  year: 1402,
  priceIRR: 900_000_000_000,
  mileageKm: 96_000,
  gearbox: 'automatic',
  plateType: 'kish',
  condition: 'used',
  hasReport: false,
};

describe('matchesFilters', () => {
  it('matches everything with the default filter set', () => {
    expect(matchesFilters(car, DEFAULT_FILTERS)).toBe(true);
  });

  it('filters by brand, model and the new trim pill', () => {
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, brand: ['nissan'] })).toBe(true);
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, brand: ['toyota'] })).toBe(false);
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, model: 'patrol' })).toBe(true);
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, model: 'patrol' }).valueOf).toBeTruthy();
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, trim: 'plat' })).toBe(true);
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, trim: 'vxr' })).toBe(false);
  });

  it('treats plate types as the schema slugs, including the national plate', () => {
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, plateType: ['kish'] })).toBe(true);
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, plateType: ['standard'] })).toBe(false);
    expect(
      matchesFilters({ ...car, plateType: 'standard' }, { ...DEFAULT_FILTERS, plateType: ['standard'] }),
    ).toBe(true);
  });

  it('applies the year, price and mileage ranges', () => {
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, yearFrom: 1403 })).toBe(false);
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, priceTo: 1 })).toBe(false);
    expect(matchesFilters(car, { ...DEFAULT_FILTERS, mileageMax: 50_000 })).toBe(false);
  });

  it('counts a pool the same way the server filters it', () => {
    const pool = [car, { ...car, brand: 'toyota' }, { ...car, plateType: 'standard' }];
    expect(countMatches(pool, DEFAULT_FILTERS)).toBe(3);
    expect(countMatches(pool, { ...DEFAULT_FILTERS, brand: ['nissan'] })).toBe(2);
  });
});
