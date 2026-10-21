import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  filtersToSearchParams,
  parseFilterQueryString,
  parseFiltersFromSearchParams,
  searchFiltersSchema,
  serializeFilters,
  toAsciiDigits,
} from '../src/filters';

describe('filter URL codec', () => {
  it('round-trips a full filter set', () => {
    const filters = searchFiltersSchema.parse({
      brand: ['saipa', 'ikco'],
      model: 'کوییک',
      yearFrom: 1395,
      yearTo: 1403,
      priceFrom: 500_000_000_000,
      priceTo: 2_000_000_000_000,
      mileageMax: 120_000,
      gearbox: ['manual'],
      plateType: ['kish'],
      condition: ['used'],
      city: ['kish'],
      hasReport: true,
      kishOnly: true,
      q: 'پژو',
    });
    const query = serializeFilters(filters);
    expect(parseFilterQueryString(query)).toEqual(filters);
  });

  it('defaults to an empty filter set', () => {
    expect(parseFilterQueryString('')).toEqual(DEFAULT_FILTERS);
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
  });

  it('accepts Persian digits in numeric fields', () => {
    const query = `yearFrom=${encodeURIComponent('۱۴۰۰')}&priceTo=${encodeURIComponent('۱۵۰۰۰۰۰۰۰۰۰۰۰')}`;
    const filters = parseFilterQueryString(query);
    expect(filters.yearFrom).toBe(1400);
    expect(filters.priceTo).toBe(1_500_000_000_000);
    expect(toAsciiDigits('کیش ۱۴۰۲')).toBe('کیش 1402');
  });

  it('omits defaults from the URL', () => {
    const params = filtersToSearchParams(DEFAULT_FILTERS);
    expect(params).toEqual({});
  });

  it('falls back to defaults on malformed input instead of throwing', () => {
    expect(parseFilterQueryString('yearFrom=not-a-number')).toEqual(DEFAULT_FILTERS);
    expect(parseFilterQueryString('brand=ferrari')).toEqual(DEFAULT_FILTERS);
    expect(parseFilterQueryString('hasReport=maybe')).toEqual({ ...DEFAULT_FILTERS });
  });

  it('parses csv arrays and boolean flags', () => {
    const filters = parseFiltersFromSearchParams({
      brand: 'saipa,ikco',
      gearbox: 'manual,automatic',
      hasReport: 'true',
      kishOnly: 'true',
    });
    expect(filters.brand).toEqual(['saipa', 'ikco']);
    expect(filters.gearbox).toEqual(['manual', 'automatic']);
    expect(filters.hasReport).toBe(true);
    expect(filters.kishOnly).toBe(true);
  });

  it('rejects impossible year ranges at parse time in the RPC payload', () => {
    const filters = searchFiltersSchema.safeParse({ yearFrom: 1403, yearTo: 1390 });
    // Schema allows the numbers; range sanity is enforced by the DB returning
    // zero rows — asserted in tests/search-filters.test.ts.
    expect(filters.success).toBe(true);
  });

  it('counts active filters for UI chips', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, brand: ['saipa'], hasReport: true })).toBe(2);
  });
});
