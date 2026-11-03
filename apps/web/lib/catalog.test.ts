import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { fixtureListings } from './data/fixtures';
import { applyFiltersLocally } from './data/listings';
import {
  SORT_KEYS,
  SORT_LABELS,
  SORT_OPTION_KEYS,
  parseSortKey,
  sortListings,
} from './sort';
import { NAV_ITEMS } from './nav';

const fixtures = fixtureListings;

describe('catalog sorting (sold always last)', () => {
  it('keeps sold after every active listing in all sort keys', () => {
    for (const key of ['newest', 'priceAsc', 'priceDesc', 'mostViewed'] as const) {
      const sorted = sortListings(fixtures, key);
      const lastSoldIndex = sorted.findLastIndex((l) => l.state === 'sold');
      const firstNonSoldIndex = sorted.findIndex((l) => l.state !== 'sold');
      expect(lastSoldIndex, key).toBe(sorted.length - 1);
      expect(firstNonSoldIndex, key).toBe(0);
    }
  });

  it('most viewed ranks by view count, sold still anchored last', () => {
    const active = sortListings(fixtures, 'mostViewed').filter((l) => l.state !== 'sold');
    const counts = active.map((l) => l.views ?? 0);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('sorts by price within the active group', () => {
    const sorted = sortListings(fixtures, 'priceAsc').filter((l) => l.state !== 'sold');
    const prices = sorted.map((l) => l.priceIRR);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('newest = featured first, then recency (mirrors the RPC browse order)', () => {
    const sorted = sortListings(fixtures, 'newest').filter((l) => l.state !== 'sold');
    const featured = sorted.filter((l) => l.featured);
    const rest = sorted.filter((l) => !l.featured);
    // every featured listing precedes every non-featured one
    expect(sorted.indexOf(featured[0]!)).toBe(0);
    const times = rest.map((l) => Date.parse(l.publishedAt ?? '0'));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('default browse order mirrors the RPC: sold last, featured first, then recency', () => {
    const browsed = applyFiltersLocally(fixtures, DEFAULT_FILTERS);
    // The featured Kish import leads the catalogue; the demo seed deliberately
    // opens on the luxury inventory (see fixtures.ts).
    expect(browsed[0]?.slug).toBe('land-cruiser-kish');
    expect(browsed[0]?.featured).toBe(true);
  });

  it('parseSortKey falls back to newest on junk', () => {
    expect(parseSortKey('priceAsc')).toBe('priceAsc');
    expect(parseSortKey('nope')).toBe('newest');
    expect(parseSortKey(undefined)).toBe('newest');
  });
});

describe('sort options (the standard marketplace orders)', () => {
  it('offers newest, cheapest, priciest and most viewed', () => {
    expect(SORT_OPTION_KEYS).toEqual(['newest', 'priceAsc', 'priceDesc', 'mostViewed']);
    expect(Object.values(SORT_LABELS)).toEqual([
      'جدیدترین',
      'ارزان‌ترین',
      'گران‌ترین',
      'پربازدیدترین',
    ]);
  });

  it('every option stays parseable so ?sort= URLs keep working', () => {
    expect(SORT_KEYS).toContain('newest');
    expect(parseSortKey('newest')).toBe('newest');
    expect(parseSortKey('mostViewed')).toBe('mostViewed');
  });
});

describe('launch city rule (city_selection off → Kish-only browse)', () => {
  it('excludes other cities by default, includes them once the flag is on', () => {
    const result = applyFiltersLocally(fixtures, DEFAULT_FILTERS);
    expect(result.every((l) => l.city === 'kish')).toBe(true);
    expect(result.some((l) => l.slug === 'm5-tehran')).toBe(false);
  });
});

describe('local filter path (parity with the RPC semantics)', () => {
  it('sold stays visible in browse', () => {
    const result = applyFiltersLocally(fixtures, DEFAULT_FILTERS);
    expect(result.some((l) => l.slug === 'amg-gt-sold')).toBe(true);
    expect(result.at(-1)?.slug).toBe('amg-gt-sold');
  });

  it('filters by brand and price range', () => {
    const result = applyFiltersLocally(fixtures, {
      ...DEFAULT_FILTERS,
      brand: ['other'],
      priceTo: 1_100_000_000_000,
    });
    expect(result.every((l) => l.brand === 'other')).toBe(true);
    expect(result.every((l) => l.priceIRR <= 1_100_000_000_000)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('filters by hasReport and kishOnly', () => {
    const reported = applyFiltersLocally(fixtures, { ...DEFAULT_FILTERS, hasReport: true });
    expect(reported.map((l) => l.slug)).toEqual(['huracan-showroom']);

    const kish = applyFiltersLocally(fixtures, { ...DEFAULT_FILTERS, kishOnly: true });
    expect(kish.every((l) => l.city === 'kish')).toBe(true);
  });

  it('quick search matches model text', () => {
    const result = applyFiltersLocally(fixtures, { ...DEFAULT_FILTERS, q: 'Camaro' });
    expect(result.map((l) => l.slug).sort()).toEqual(['camaro-alice', 'camaro-kish']);
  });
});

describe('navigation destinations (same five on every device)', () => {
  it('lists the five destinations in the approved order', () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual([
      'home',
      'chats',
      'post',
      'favorites',
      'profile',
    ]);
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      'خانه',
      'چت‌ها',
      'ثبت آگهی',
      'علاقه‌مندی‌ها',
      'پروفایل',
    ]);
  });

  it('the center item is the raised post action', () => {
    const primary = NAV_ITEMS.filter((i) => i.primary);
    expect(primary).toHaveLength(1);
    expect(primary[0]?.key).toBe('post');
    expect(primary[0]?.href).toBe('/new');
  });
});

