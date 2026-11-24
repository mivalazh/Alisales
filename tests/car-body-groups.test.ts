import { describe, expect, it } from 'vitest';
import {
  BODY_TYPE_HINTS,
  BODY_TYPE_LABELS,
  CAR_BODY_GROUPS,
  browseGroupsFor,
  inferBodyType,
  matchesBodyKeyword,
  type BodyType,
} from '@alisales/schemas';
import { CAR_BODY_TYPES, filterByBodyType, parseBodyType } from '../apps/web/lib/browse';
import type { ListingCardData } from '../apps/web/lib/data/listings';

/**
 * One keyword table behind both halves of the body class.
 *
 * `CAR_BODY_GROUPS` now decides the stored `vehicles.body_type` (through
 * `BODY_TYPE_HINTS`, which 0016/0022 mirror in SQL) and the drawer's `?body=`
 * chips (through the web app's `CAR_BODY_TYPES`). These tests pin both
 * derivations, the inference order the SQL copy depends on, and the split that
 * makes the collapse safe: `keywords` classify, `browseOnly` words only narrow
 * a chip.
 */

const bodyClasses = BODY_TYPE_HINTS.map(([body]) => body);

const car = (model: string, overrides: Partial<ListingCardData> = {}): ListingCardData =>
  ({ model, trim: null, kind: 'vehicle', category: 'car', ...overrides }) as ListingCardData;

describe('the table keeps the inference exactly as it was', () => {
  it('exposes the body classes in the order the SQL migrations mirror', () => {
    // Order is the contract, not just the membership: first match wins, and
    // 0022's (body, hints) VALUES table is compared verbatim by the drift test.
    expect(bodyClasses).toEqual([
      'pickup',
      'van',
      'convertible',
      'coupe',
      'suv',
      'hatchback',
      'sedan',
    ]);
  });

  it('still resolves the reference models the way 0022 assumes', () => {
    const cases: Array<[string, BodyType | null]> = [
      ['Hilux', 'pickup'],
      ['Ram 1500', 'pickup'],
      ['Carnival', 'van'],
      ['Boxster', 'convertible'],
      ['911', 'coupe'],
      ['Land Cruiser', 'suv'],
      ['GLE 500', 'suv'],
      ['Golf', 'hatchback'],
      ['Fiat 500', 'hatchback'],
      ['Camry', 'sedan'],
      ['Cerato', 'sedan'],
      ['Mercedes S 500', null],
      ['Tramontana', null],
    ];
    for (const [model, body] of cases) {
      expect(inferBodyType(model), model).toBe(body);
    }
  });

  it('never classifies a car from a browse-only word', () => {
    // The whole reason the split exists: «sport» is a trim word, not a class.
    expect(inferBodyType('Sportster S')).toBeNull();
    expect(inferBodyType('F-Sport')).toBeNull();
    expect(inferBodyType('Crossover')).toBeNull();
    expect(inferBodyType('Hybrid')).toBeNull();
    expect(inferBodyType('Lexus')).toBeNull();
    for (const [, keywords] of BODY_TYPE_HINTS) {
      expect(keywords).not.toContain('sport');
      expect(keywords).not.toContain('suv');
      expect(keywords).not.toContain('hybrid');
    }
  });
});

describe('the browse chips are derived from the same table', () => {
  it('keeps the drawer groups, labels and menu order', () => {
    expect(CAR_BODY_TYPES.map((group) => group.key)).toEqual([
      'suv',
      'sedan',
      'hatchback',
      'coupe',
      'crossover',
      'luxury',
      'hybrid',
    ]);
    expect(CAR_BODY_TYPES.map((group) => group.label)).toEqual([
      'SUV',
      'سدان',
      'هاچ‌بک',
      'کوپه و اسپرت',
      'کراس‌اوور',
      'لوکس و لیموزین',
      'خودروی برقی و هیبرید',
    ]);
    expect(parseBodyType('suv')?.label).toBe('SUV');
    expect(parseBodyType('hybrid')?.label).toBe('خودروی برقی و هیبرید');
    expect(parseBodyType('spaceship')).toBeNull();
  });

  it('leaves the three browse-only groups without a stored class', () => {
    for (const key of ['crossover', 'luxury', 'hybrid']) {
      const group = CAR_BODY_GROUPS.find((entry) => entry.key === key)!;
      expect(group.bodyType, key).toBeNull();
    }
    // crossover is a real bodyType a seller can pick, but no hint infers it —
    // assigning it behind the seller's back would move rows between stored
    // values. Keep it out of the inference table on purpose.
    expect(bodyClasses).not.toContain('crossover');
  });

  it('gives a body chip the inference knowledge it used to miss', () => {
    // These words were only in the SQL/inference table before; the chips now
    // share them, so «?body=suv» finally includes an X7 or a Macan.
    const suv = parseBodyType('suv')!;
    expect(suv.keywords).toContain('x7');
    expect(suv.keywords).toContain('macan');
    const hatchback = parseBodyType('hatchback')!;
    expect(hatchback.keywords).toContain('golf');
    expect(hatchback.keywords).toContain('fiat 500');
  });

  it('keeps «cerato» browsable as a hatchback without overriding its class', () => {
    expect(parseBodyType('hatchback')!.keywords).toContain('cerato');
    expect(inferBodyType('Cerato')).toBe('sedan');
  });

  it('matches through the one shared comparator', () => {
    expect(matchesBodyKeyword('Land Cruiser VXR', ['land cruiser'])).toBe(true);
    expect(matchesBodyKeyword('LAND CRUISER', ['land cruiser'])).toBe(true);
    expect(matchesBodyKeyword('Camry', ['land cruiser'])).toBe(false);
    expect(matchesBodyKeyword(null, ['suv'])).toBe(false);
  });
});

describe('filterByBodyType', () => {
  it('narrows cars by model and trim', () => {
    const suv = parseBodyType('suv')!;
    expect(
      filterByBodyType([car('Land Cruiser', { trim: 'VXR' }), car('Patrol'), car('Camry')], suv).map(
        (listing) => listing.model,
      ),
    ).toEqual(['Land Cruiser', 'Patrol']);
  });

  it('never matches parts, motorcycles or heavy machinery', () => {
    const coupe = parseBodyType('coupe')!;
    const rows = [
      car('Mustang'),
      car('Sportster S', { category: 'motorcycle' }),
      car('X5', { category: 'heavy' }),
      { model: 'Coupe mirror', kind: 'part', part: { category: 'body' } } as unknown as ListingCardData,
    ];
    expect(filterByBodyType(rows, coupe).map((listing) => listing.model)).toEqual(['Mustang']);
  });
});

describe('browseGroupsFor (the persisted-array prototype, 0024)', () => {
  it('returns the chips in menu order, including browse-only words', () => {
    expect(browseGroupsFor('Cerato')).toEqual(['sedan', 'hatchback']);
    expect(browseGroupsFor('Land Cruiser', 'VXR')).toEqual(['suv']);
    expect(browseGroupsFor('F-Sport')).toEqual(['coupe']);
    expect(browseGroupsFor('Panamera')).toEqual(['luxury']);
    expect(browseGroupsFor('Prius')).toEqual(['hybrid']);
  });

  it('agrees with the chip for every model the fixtures carry', () => {
    const models = [
      'Camry',
      'Land Cruiser',
      'Golf',
      '911',
      'X5',
      'S-Class',
      'HR-V',
      'Prius',
      'Fiat 500',
      'RX 450h',
    ];
    for (const model of models) {
      for (const group of CAR_BODY_TYPES) {
        const stored = browseGroupsFor(model).includes(group.key);
        const chipped = filterByBodyType([car(model)], group).length === 1;
        expect(stored, `${model} · ${group.key}`).toBe(chipped);
      }
    }
  });

  it('stores nothing for a model no chip knows', () => {
    expect(browseGroupsFor('Pride')).toEqual([]);
    expect(browseGroupsFor(null)).toEqual([]);
  });
});

describe('the table itself', () => {
  it('has one label and one browse slot per group, and unique menu order', () => {
    for (const group of CAR_BODY_GROUPS) {
      expect(group.label.length).toBeGreaterThan(0);
      expect(group.keywords.length).toBeGreaterThan(0);
      if (group.bodyType) expect(BODY_TYPE_LABELS[group.bodyType].length).toBeGreaterThan(0);
    }
    const orders = CAR_BODY_GROUPS.map((group) => group.browseOrder).filter(
      (order): order is number => order !== null,
    );
    expect(new Set(orders).size).toBe(orders.length);
  });
});
