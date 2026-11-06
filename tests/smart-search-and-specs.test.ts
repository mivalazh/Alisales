import { describe, expect, it } from 'vitest';
import {
  BODY_TYPE_LABELS,
  PLATE_TYPE_LABELS,
  bodyTypes,
  colorLabel,
  fuzzySearchMatch,
  fuzzySuggestions,
  normalizeSearchText,
  searchFiltersSchema,
} from '@alisales/schemas';
import { matchesFilters, type FilterableListing } from '../apps/web/lib/filter-match';

/**
 * Search is the product's front door: a Kish buyer types «لندکروز»,
 * «لندكروزر», «landcruiser» or a one-letter typo, and must still land on the
 * right listing. These cases pin the normalizer, the synonym table and the
 * distance fallback together.
 */
describe('Persian-aware fuzzy search', () => {
  it('folds Arabic letters, ZWNJ and Persian digits', () => {
    expect(normalizeSearchText('لندكروزر')).toBe(normalizeSearchText('لندکروزر'));
    expect(normalizeSearchText('مرسدس‌بنز')).toBe('مرسدس بنز');
    expect(normalizeSearchText('۲۰۲۲')).toBe('2022');
    expect(normalizeSearchText('MERCEDES-BENZ')).toBe('mercedes benz');
  });

  const landCruiser = 'Toyota Land Cruiser VXR';

  it('matches Persian, transliterated and spaced spellings', () => {
    for (const query of ['لندکروز', 'لندكروزر', 'landcruiser', 'land cruiser', 'تویوتا لندکروز']) {
      expect(fuzzySearchMatch(landCruiser, query)).toBe(true);
    }
  });

  it('tolerates one or two character typos', () => {
    expect(fuzzySearchMatch('Nissan Patrol Platinum', 'باترول')).toBe(true);
    expect(fuzzySearchMatch('Porsche Cayenne', 'کایین')).toBe(true);
    expect(fuzzySearchMatch('Porsche Cayenne', 'پورش')).toBe(true);
    expect(fuzzySearchMatch('Brake Pad Set', 'لنت')).toBe(true);
    expect(fuzzySearchMatch('Mercedes-Benz S 500', 'بنز')).toBe(true);
  });

  it('does not match an unrelated word', () => {
    expect(fuzzySearchMatch(landCruiser, 'کامیون')).toBe(false);
    expect(fuzzySearchMatch('', 'تویوتا')).toBe(false);
  });

  it('suggests the canonical spelling while typing', () => {
    expect(fuzzySuggestions('لندکروز', ['Land Cruiser', 'Prado', 'Patrol'])).toEqual([
      'Land Cruiser',
    ]);
    expect(fuzzySuggestions('پورش', ['Porsche', 'Prado'])).toEqual(['Porsche']);
  });
});

describe('new listing specs', () => {
  it('offers the eight standard body classes with Persian labels', () => {
    expect(bodyTypes).toHaveLength(8);
    expect(BODY_TYPE_LABELS.sedan).toBe('سدان (سواری)');
    expect(BODY_TYPE_LABELS.suv).toBe('شاسی‌بلند (SUV)');
    expect(BODY_TYPE_LABELS.pickup).toBe('پیکاپ / وانت');
  });

  it('renames the free-zone plate everywhere it is labelled', () => {
    expect(PLATE_TYPE_LABELS.kish).toBe('پلاک منطقه آزاد');
  });

  it('keeps the typed colour and translates legacy slugs', () => {
    expect(colorLabel('سفید صدفی')).toBe('سفید صدفی');
    expect(colorLabel('white')).toBe('سفید');
    expect(colorLabel(null)).toBe('');
  });

  it('filters by body class without touching other categories', () => {
    const listing = {
      city: 'kish',
      brand: 'toyota',
      model: 'Land Cruiser',
      year: 2022,
      priceIRR: 1,
      mileageKm: 1000,
      gearbox: 'automatic',
      plateType: 'kish',
      condition: 'used',
      bodyType: 'suv',
      hasReport: false,
      category: 'car',
    } satisfies FilterableListing;
    const filters = searchFiltersSchema.parse({ bodyType: ['suv'] });
    expect(matchesFilters(listing, filters)).toBe(true);
    expect(
      matchesFilters(listing, searchFiltersSchema.parse({ bodyType: ['sedan'] })),
    ).toBe(false);
  });

  it('parses the drawer shortcut URLs into real filters', () => {
    const parsed = searchFiltersSchema.parse({
      bodyType: ['suv'],
      plateType: ['kish'],
    });
    expect(parsed.bodyType).toEqual(['suv']);
    expect(parsed.plateType).toEqual(['kish']);
  });
});
