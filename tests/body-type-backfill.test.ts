import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inferBodyType } from '@alisales/schemas';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, IDS } from './helpers/pg';

/**
 * Body classes for cars published before 0014.
 *
 * `vehicles.body_type` is nullable, so pre-0014 rows read back with no class.
 * The browser infers one from the model, but `search_listings` filters on the
 * stored column: a hosted `/cars?bodyType=suv` never saw those rows. 0016
 * writes the same inference into the column. These tests write rows the way
 * the old publish path did, prove the RPC misses them first, apply the
 * backfill, and prove the real payload the route sends now finds them.
 */

const BACKFILL = readFileSync(
  fileURLToPath(new URL('../supabase/migrations/0016_body_type_backfill.sql', import.meta.url)),
  'utf8',
);

let db: PGlite;

/** Legacy cars: model → the class the shared inference assigns (or none). */
const LEGACY: Record<string, { model: string; body: string | null }> = {
  suv: { model: 'Land Cruiser', body: 'suv' },
  sedan: { model: 'Camry', body: 'sedan' },
  hatchback: { model: 'Golf', body: 'hatchback' },
  pickup: { model: 'Hilux', body: 'pickup' },
  van: { model: 'Carnival', body: 'van' },
  convertible: { model: 'Boxster', body: 'convertible' },
  coupe: { model: '911', body: 'coupe' },
  // No hint recognises this model, so it must stay null rather than guess.
  unknown: { model: 'Shahin', body: null },
};

const IDS_BY_CLASS: Record<string, string> = {};
const slug = (key: string) => `legacy-body-${key}`;

/** A row as the pre-0014 publish path wrote it: no body class. */
async function addLegacyCar(
  key: string,
  model: string,
  overrides: { bodyType?: string | null; category?: string; brand?: string } = {},
): Promise<void> {
  const inserted = await db.query<{ id: string }>(
    `insert into public.vehicles
       (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition,
        plate_type, category, body_type)
     values ($1, $2, $3, 1402, 1000, 'automatic', 'petrol', 'white', 'used',
             'standard', $4, $5)
     returning id`,
    [
      IDS.alice,
      overrides.brand ?? 'toyota',
      model,
      overrides.category ?? 'car',
      overrides.bodyType ?? null,
    ],
  );
  const id = inserted.rows[0]!.id;
  IDS_BY_CLASS[key] = id;
  await db.query(
    `insert into public.listings
       (slug, created_by, vehicle_id, kind, price_irr, city, description, state,
        allow_phone_reveal, published_at)
     values ($1, $2, $3, 'vehicle', 10_000_000_000, 'kish', 'ردیف قدیمی', 'active', true, now())`,
    [slug(key), IDS.alice, id],
  );
}

async function bodyTypeOf(id: string): Promise<string | null> {
  const result = await db.query<{ body_type: string | null }>(
    `select body_type from public.vehicles where id = $1`,
    [id],
  );
  return result.rows[0]!.body_type;
}

/** The RPC call the web route makes, with the same jsonb payload shape. */
async function search(filters: Record<string, unknown>): Promise<string[]> {
  const result = await db.query<{ slug: string }>(
    `select slug from public.search_listings($1::jsonb, 100)`,
    [JSON.stringify(filters)],
  );
  return result.rows.map((row) => row.slug);
}

beforeAll(async () => {
  db = await createDb();
  for (const [key, entry] of Object.entries(LEGACY)) {
    await addLegacyCar(key, entry.model);
  }
  // An explicit pick is data, not a guess: it must survive the backfill.
  await addLegacyCar('explicit', 'Land Cruiser', { bodyType: 'sedan' });
  // A motorcycle has no body class and must not be given one.
  await addLegacyCar('bike', 'MT-09', { category: 'motorcycle', brand: 'bike-yamaha' });
});

afterAll(async () => {
  await db?.close();
});

describe('0016 backfills the body class of pre-0014 cars', () => {
  it('leaves them classless, so a body filter misses them', async () => {
    expect(await bodyTypeOf(IDS_BY_CLASS.suv!)).toBeNull();

    // The regression: the row exists and is active, but the RPC cannot see it.
    const cards = await search({ category: 'car' });
    expect(cards).toContain(slug('suv'));
    expect(await search({ category: 'car', bodyType: 'suv' })).not.toContain(slug('suv'));
  });

  it('stores the class the shared keyword inference assigns', async () => {
    await db.exec(BACKFILL);

    for (const [key, entry] of Object.entries(LEGACY)) {
      const label = `${key} (${entry.model})`;
      expect(await bodyTypeOf(IDS_BY_CLASS[key]!), label).toBe(entry.body);
      // The SQL result must equal what the API would infer from the same model.
      expect(inferBodyType(entry.model), label).toBe(entry.body);
    }
  });

  it('finds the rows through the body filter the /cars drawer sends', async () => {
    for (const [key, entry] of Object.entries(LEGACY)) {
      if (!entry.body) continue;
      const cards = await search({ category: 'car', bodyType: entry.body });
      expect(cards, `${entry.body} should include ${key}`).toContain(slug(key));
    }

    // A different class never pulls them in.
    expect(await search({ category: 'car', bodyType: 'suv' })).not.toContain(slug('sedan'));
    // And a class no hint assigns still matches nothing.
    expect(await search({ category: 'car', bodyType: 'crossover' })).toEqual([]);
  });

  it('never overrides an explicit class, guesses nothing, spares non-cars', async () => {
    expect(await bodyTypeOf(IDS_BY_CLASS.explicit!)).toBe('sedan');
    expect(await search({ category: 'car', bodyType: 'sedan' })).toContain(slug('explicit'));

    expect(await bodyTypeOf(IDS_BY_CLASS.unknown!)).toBeNull();
    expect(await search({ category: 'car', bodyType: 'sedan' })).not.toContain(slug('unknown'));

    expect(await bodyTypeOf(IDS_BY_CLASS.bike!)).toBeNull();
  });

  it('is idempotent', async () => {
    await db.exec(BACKFILL);

    expect(await bodyTypeOf(IDS_BY_CLASS.suv!)).toBe('suv');
    expect(await bodyTypeOf(IDS_BY_CLASS.explicit!)).toBe('sedan');
    expect(await bodyTypeOf(IDS_BY_CLASS.bike!)).toBeNull();
  });
});
