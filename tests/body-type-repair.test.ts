import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inferBodyType } from '@alisales/schemas';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, IDS } from './helpers/pg';

/**
 * Rows 0016 already wrote with the retired «500» / «ram» keywords.
 *
 * 0016 is applied history and `vehicles.body_type` is a stored column the SQL
 * search filters on, so dropping a keyword from `BODY_TYPE_HINTS` fixes new
 * writes only. 0022 repairs what the old table left behind: states the wrong
 * class the way 0016 wrote it, applies the repair, and proves the stored column
 * the `/cars?bodyType=…` RPC reads now matches the shared inference.
 */

const REPAIR = readFileSync(
  fileURLToPath(new URL('../supabase/migrations/0022_body_type_keyword_repair.sql', import.meta.url)),
  'utf8',
);

let db: PGlite;

/** model → { stored: what 0016 wrote, repaired: what 0022 must leave }. */
const ROWS: Record<string, { model: string; stored: string | null; repaired: string | null }> = {
  // The bug: '500' matched inside a Mercedes model.
  s500: { model: 'Mercedes S 500', stored: 'hatchback', repaired: null },
  s500brand: { model: 'Mercedes-Benz S 500', stored: 'hatchback', repaired: null },
  // 'gle' is a current SUV hint, so the repair does not stop at null.
  gle500: { model: 'GLE 500', stored: 'hatchback', repaired: 'suv' },
  // A real Fiat 500 keeps its class through the «fiat 500» hint.
  fiat500: { model: 'Fiat 500', stored: 'hatchback', repaired: 'hatchback' },
  // 'ram' matched inside an unrelated name; the model is not a Ram pickup.
  tramontana: { model: 'Tramontana', stored: 'pickup', repaired: null },
  // Named Ram pickups stay pickups.
  ram1500: { model: 'Ram 1500', stored: 'pickup', repaired: 'pickup' },
  // Unrelated rows are re-derived to the same class.
  golf: { model: 'Golf', stored: 'hatchback', repaired: 'hatchback' },
};

const IDS_BY_KEY: Record<string, string> = {};

async function addCar(
  key: string,
  model: string,
  bodyType: string | null,
  overrides: { category?: string; brand?: string } = {},
): Promise<void> {
  const inserted = await db.query<{ id: string }>(
    `insert into public.vehicles
       (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition,
        plate_type, category, body_type)
     values ($1, $2, $3, 1402, 1000, 'automatic', 'petrol', 'white', 'used',
             'standard', $4, $5)
     returning id`,
    [IDS.alice, overrides.brand ?? 'mercedes', model, overrides.category ?? 'car', bodyType],
  );
  const id = inserted.rows[0]!.id;
  IDS_BY_KEY[key] = id;
  await db.query(
    `insert into public.listings
       (slug, created_by, vehicle_id, kind, price_irr, city, description, state,
        allow_phone_reveal, published_at)
     values ($1, $2, $3, 'vehicle', 10_000_000_000, 'kish', 'آگهی قدیمی', 'active', true, now())`,
    [`repair-body-${key}`, IDS.alice, id],
  );
}

async function bodyTypeOf(id: string): Promise<string | null> {
  const result = await db.query<{ body_type: string | null }>(
    `select body_type from public.vehicles where id = $1`,
    [id],
  );
  return result.rows[0]!.body_type;
}

async function search(filters: Record<string, unknown>): Promise<string[]> {
  const result = await db.query<{ slug: string }>(
    `select slug from public.search_listings($1::jsonb, 100)`,
    [JSON.stringify(filters)],
  );
  return result.rows.map((row) => row.slug);
}

beforeAll(async () => {
  db = await createDb();
  for (const [key, row] of Object.entries(ROWS)) {
    await addCar(key, row.model, row.stored);
  }
  // A seller's explicit pick that the retired keywords never implied.
  await addCar('explicit', 'Land Cruiser', 'sedan');
  // A motorcycle has no body class and must not be given one.
  await addCar('bike', 'Tramontana', 'pickup', { category: 'motorcycle', brand: 'bike-yamaha' });
});

afterAll(async () => {
  await db?.close();
});

describe('0022 repairs body classes written from the retired keywords', () => {
  it('starts from the wrong column 0016 wrote, as the RPC sees it', async () => {
    expect(await bodyTypeOf(IDS_BY_KEY.s500!)).toBe('hatchback');
    expect(await search({ category: 'car', bodyType: 'hatchback' })).toContain('repair-body-s500');
  });

  it('stores the class the current shared inference assigns', async () => {
    await db.exec(REPAIR);

    for (const [key, row] of Object.entries(ROWS)) {
      const label = `${key} (${row.model})`;
      expect(await bodyTypeOf(IDS_BY_KEY[key]!), label).toBe(row.repaired);
      // The SQL result must equal what the API infers from the same model.
      expect(inferBodyType(row.model), label).toBe(row.repaired);
    }
  });

  it('removes the misclassified rows from the body filter', async () => {
    const hatchbacks = await search({ category: 'car', bodyType: 'hatchback' });
    expect(hatchbacks).not.toContain('repair-body-s500');
    expect(hatchbacks).not.toContain('repair-body-s500brand');
    expect(hatchbacks).toContain('repair-body-fiat500');

    const pickups = await search({ category: 'car', bodyType: 'pickup' });
    expect(pickups).not.toContain('repair-body-tramontana');
    expect(pickups).toContain('repair-body-ram1500');

    expect(await search({ category: 'car', bodyType: 'suv' })).toContain('repair-body-gle500');
  });

  it('keeps explicit picks and spares non-cars', async () => {
    expect(await bodyTypeOf(IDS_BY_KEY.explicit!)).toBe('sedan');
    expect(await bodyTypeOf(IDS_BY_KEY.bike!)).toBe('pickup');
  });

  it('is idempotent', async () => {
    await db.exec(REPAIR);

    for (const [key, row] of Object.entries(ROWS)) {
      expect(await bodyTypeOf(IDS_BY_KEY[key]!), key).toBe(row.repaired);
    }
    expect(await bodyTypeOf(IDS_BY_KEY.explicit!)).toBe('sedan');
  });
});
