import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CAR_BODY_TYPES, filterByBodyType, parseBodyType } from '../apps/web/lib/browse';
import { browseGroupsFor, matchesBodyKeyword } from '@alisales/schemas';
import type { ListingCardData } from '../apps/web/lib/data/listings';
import { createDb, IDS } from './helpers/pg';
import type { PGlite } from '@electric-sql/pglite';

/**
 * One keyword table, two engines, one answer.
 *
 * A curated `?body=` group is narrowed twice: the route resolves the key to
 * `CAR_BODY_GROUPS` keywords and the SQL page applies them
 * (`p_filters->'bodyKeywords'`, 0023), while the fixture path and the grid's
 * own narrowing apply `filterByBodyType`. If the two predicates disagree, a
 * paged curated view shows fewer rows than the pool says it has (or duplicates
 * one across a page boundary), and the static first paint disagrees with the
 * hydrated grid.
 *
 * This file runs the real SQL against a catalogue seeded to hit both sides of
 * every rule — an early keyword, a `browseOnly` word, a motorcycle and a heavy
 * machine whose model contains a car keyword, and a part whose title does — and
 * diffs the paged RPC against the browser predicate for **every** group in the
 * drawer, page by page.
 */

let db: PGlite;

interface Seed {
  slug: string;
  model: string;
  trim?: string | null;
  category?: 'car' | 'motorcycle' | 'heavy';
  part?: string;
}

const SEEDS: Seed[] = [
  { slug: 'pg-suv-toyota', model: 'Land Cruiser VXR', trim: 'VXR' },
  { slug: 'pg-suv-lexus', model: 'RX 450h', trim: 'F-Sport' },
  { slug: 'pg-hatch-vw', model: 'Golf GTI', trim: 'GTI' },
  { slug: 'pg-hatch-fiat', model: 'Fiat 500' },
  { slug: 'pg-sedan-camry', model: 'Camry' },
  { slug: 'pg-sedan-cerato', model: 'Cerato' },
  { slug: 'pg-coupe-mclaren', model: '720S' },
  { slug: 'pg-coupe-porsche', model: '911 Carrera', trim: 'Carrera' },
  { slug: 'pg-lux-sclass', model: 'S-Class', trim: 'S 500' },
  { slug: 'pg-hybrid-prius', model: 'Prius' },
  // Model text that must not drag these into a car chip.
  { slug: 'pg-bike-sportster', model: 'Sportster S', category: 'motorcycle' },
  { slug: 'pg-heavy-camaro', model: 'Camaro wheel loader', category: 'heavy' },
  // A part's title is never a body class.
  { slug: 'pg-part-camaro', model: 'Camaro mirror', part: 'آینه کوپه کامارو' },
];

async function seed(): Promise<void> {
  let index = 0;
  for (const row of SEEDS) {
    index += 1;
    if (row.part) {
      const listing = await db.query<{ id: string }>(
        `insert into public.listings
           (slug, created_by, kind, price_irr, city, description, state,
            allow_phone_reveal, published_at)
         values ($1, $2, 'part', 1_000_000, 'kish', 'قطعه', 'active', true, now() - ($3 || ' seconds')::interval)
         returning id`,
        [row.slug, IDS.alice, String(index)],
      );
      await db.query(
        `insert into public.part_details (listing_id, category, title, origin, condition)
         values ($1, 'body', $2, 'original', 'new')`,
        [listing.rows[0]!.id, row.part],
      );
      continue;
    }
    const vehicle = await db.query<{ id: string }>(
      `insert into public.vehicles
         (created_by, brand, model, trim, year, mileage_km, gearbox, fuel, color, condition,
          plate_type, category, browse_groups)
       values ($1, 'toyota', $2, $3, 1402, 1_000, 'automatic', 'petrol', 'white', 'used',
               'standard', $4, $5)
       returning id`,
      [
        IDS.alice,
        row.model,
        row.trim ?? null,
        row.category ?? 'car',
        // The write path for the 0024 prototype: the same derivation every
        // writer uses, and `{}` for a machine (the chips are car classes).
        row.category && row.category !== 'car' ? [] : browseGroupsFor(row.model, row.trim),
      ],
    );
    await db.query(
      `insert into public.listings
         (slug, created_by, vehicle_id, kind, price_irr, city, description, state,
          allow_phone_reveal, published_at)
       values ($1, $2, $3, 'vehicle', 10_000_000_000, 'kish', 'خودرو', 'active', true,
               now() - ($4 || ' seconds')::interval)`,
      [row.slug, IDS.alice, vehicle.rows[0]!.id, String(index)],
    );
  }
}

/** Every visible card, in `search_listings` order — the pool the chips narrow. */
async function pool(): Promise<ListingCardData[]> {
  const result = await db.query<ListingCardData>(
    `select * from public.search_listings('{}'::jsonb, 1000)`,
  );
  return result.rows;
}

/** One page from the keyset RPC, exactly as the route calls it. */
async function page(
  bodyKeywords: readonly string[],
  limit: number,
  cursor: string | null,
): Promise<{ rows: ListingCardData[]; nextCursor: string | null }> {
  const result = await db.query<{ rows: ListingCardData[]; next_cursor: string | null }>(
    `select * from public.search_listings_page($1::jsonb, $2, $3)`,
    [JSON.stringify({ bodyKeywords }), limit, cursor],
  );
  const envelope = result.rows[0]!;
  return { rows: envelope.rows ?? [], nextCursor: envelope.next_cursor };
}

/** Walk the paged RPC to the end, one page at a time. */
async function paged(
  bodyKeywords: readonly string[],
  limit: number,
): Promise<{ slugs: string[]; pages: number; cursorsBound: boolean }> {
  const slugs: string[] = [];
  const cursorsBound: boolean[] = [];
  let cursor: string | null = null;
  let pages = 0;
  for (;;) {
    const current = await page(bodyKeywords, limit, cursor);
    pages += 1;
    slugs.push(...current.rows.map((row) => row.slug));
    if (!current.nextCursor) break;
    if (pages > 20) throw new Error('paging did not terminate');
    cursorsBound.push(true);
    cursor = current.nextCursor;
  }
  return { slugs, pages, cursorsBound: cursorsBound.length > 0 };
}

beforeAll(async () => {
  db = await createDb();
  await seed();
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe('every curated body group pages consistently', () => {
  const groups = CAR_BODY_TYPES;

  it('covers the drawer’s whole group list', () => {
    expect(groups.map((group) => group.key)).toEqual([
      'suv',
      'sedan',
      'hatchback',
      'coupe',
      'crossover',
      'luxury',
      'hybrid',
    ]);
  });

  for (const group of groups) {
    it(`«${group.key}» answers the same rows as filterByBodyType`, async () => {
      const expected = filterByBodyType(await pool(), group)
        .map((row) => row.slug)
        .sort();

      // Paged two at a time: a group with three or more matches must survive a
      // page boundary, which is the bug the whole-pool walk existed to avoid.
      const actual = await paged(group.keywords, 2);

      expect(actual.slugs.slice().sort()).toEqual(expected);
      expect(new Set(actual.slugs).size).toBe(actual.slugs.length);
    });
  }

  it('refuses a cursor from another group', async () => {
    const first = await page(parseBodyType('suv')!.keywords, 1, null);
    expect(first.nextCursor).toBeTruthy();
    await expect(
      page(parseBodyType('sedan')!.keywords, 1, first.nextCursor),
    ).rejects.toThrow(/cursor does not belong to this filter set/);
  });

  it('excludes machines and parts whose text contains a car keyword', async () => {
    const coupe = await paged(parseBodyType('coupe')!.keywords, 5);
    // «Camaro wheel loader» and the Camaro mirror are not coupés, and the
    // motorcycle called «Sportster» is not one either.
    expect(coupe.slugs).not.toContain('pg-heavy-camaro');
    expect(coupe.slugs).not.toContain('pg-part-camaro');
    expect(coupe.slugs).not.toContain('pg-bike-sportster');
    // …while the genuine coupé is there, and «F-Sport» still matches, exactly
    // like the chip does in the browser.
    expect(coupe.slugs).toContain('pg-coupe-mclaren');
    expect(coupe.slugs).toContain('pg-suv-lexus');
  });
});

describe('the persisted array (0024 prototype)', () => {
  it('matches what browseGroupsFor derives for the seeded rows', async () => {
    const { rows } = await db.query<{
      model: string;
      trim: string | null;
      browse_groups: string[];
    }>(
      `select model, trim, browse_groups from public.vehicles
       where id in ('00000000-0000-0000-0000-000000000039',
                    '00000000-0000-0000-0000-000000000030')`,
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // The seeds are a write path too: a column that disagrees with the
      // derivation is a chip that shows the wrong cars in local demos.
      expect(row.browse_groups, row.model).toEqual(browseGroupsFor(row.model, row.trim));
    }
  });

  it('selects the same seeded rows as the keyword predicate', async () => {
    for (const group of CAR_BODY_TYPES) {
      const words = group.keywords
        .map((word) => `'${word.replace(/'/g, "''")}'`)
        .map((word) => `v.model ilike '%' || ${word} || '%' or coalesce(v.trim, '') ilike '%' || ${word} || '%'`)
        .join(' or ');
      const keyword = await db.query<{ slug: string }>(
        `select l.slug from public.listings l
         join public.vehicles v on v.id = l.vehicle_id
         where coalesce(v.category, 'car') = 'car' and (${words})
         order by l.slug`,
      );
      const contained = await db.query<{ slug: string }>(
        `select l.slug from public.listings l
         join public.vehicles v on v.id = l.vehicle_id
         where v.browse_groups && array['${group.key}']::text[]
         order by l.slug`,
      );
      // The seeded catalogue is small, so this is mostly a shape check; the
      // 50k comparison lives in scripts/measure-browse-groups.ts.
      expect(contained.rows.map((row) => row.slug), group.key).toEqual(
        keyword.rows.map((row) => row.slug),
      );
    }
  });
});

describe('the payload is what the route can build', () => {
  it('matches words in the model or the trim, case-insensitively', async () => {
    // The haystack is `model + trim`, the same one `matchesCarBodyKeywords`
    // builds: a keyword that only appears in the brand never matches.
    expect(matchesBodyKeyword('Land Cruiser VXR VXR', ['land cruiser'])).toBe(true);
    const result = await page(['vxr'], 10, null);
    expect(result.rows.map((row) => row.slug)).toContain('pg-suv-toyota');

    const brandOnly = await page(['toyota'], 10, null);
    expect(brandOnly.rows).toEqual([]);
  });

  it('ignores anything that is not a jsonb array', async () => {
    const result = await db.query<{ rows: unknown[] }>(
      `select * from public.search_listings_page($1::jsonb, 100, null)`,
      [JSON.stringify({ bodyKeywords: 'suv' })],
    );
    // A string payload is not an allow-list of one word — it is no narrowing at
    // all, so a malformed value can never silently empty the grid.
    expect(result.rows[0]!.rows.length).toBeGreaterThan(0);
  });
});
