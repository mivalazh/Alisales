import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createDb, IDS } from './helpers/pg';

/**
 * Pre-0014 hosted rows.
 *
 * 0014 gave `vehicles` a category with `default 'car'`, so everything published
 * before it reads as a car and /motorcycles and /heavy stay empty even though
 * the view and RPC know about the categories. The prefixed brand slug is the
 * only surviving evidence, and 0015 backfills from it. These tests write rows
 * the way the old publish path did (no category, no specs), apply the backfill,
 * and then ask the real RPC — the same payload the route sends — whether the
 * rows reach their own pages.
 */

const BACKFILL = readFileSync(
  fileURLToPath(new URL('../supabase/migrations/0015_vehicle_category_backfill.sql', import.meta.url)),
  'utf8',
);

let db: PGlite;

const BIKE = 'legacy-bike-yamaha';
const HEAVY = 'legacy-heavy-volvo';
const CAR = 'legacy-car-toyota';

const ids: Record<string, string> = {};

/** A row as the pre-0014 publish path wrote it: category and specs absent. */
async function addLegacy(slug: string, brand: string, model: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.vehicles
       (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition, plate_type)
     values ($1, $2, $3, 1402, 1000, 'automatic', 'petrol', 'white', 'used', 'standard')
     returning id`,
    [IDS.alice, brand, model],
  );
  const id = result.rows[0]!.id;
  await db.query(
    `insert into public.listings
       (slug, created_by, vehicle_id, kind, price_irr, city, description, state,
        allow_phone_reveal, published_at)
     values ($1, $2, $3, 'vehicle', 10_000_000_000, 'kish', 'ردیف قدیمی', 'active', true, now())`,
    [slug, IDS.alice, id],
  );
  return id;
}

async function categoryOf(id: string): Promise<string> {
  const result = await db.query<{ category: string }>(
    `select category from public.vehicles where id = $1`,
    [id],
  );
  return result.rows[0]!.category;
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
  ids.bike = await addLegacy(BIKE, 'bike-yamaha', 'MT-09');
  ids.heavy = await addLegacy(HEAVY, 'heavy-volvo', 'FH16');
  ids.car = await addLegacy(CAR, 'toyota', 'Land Cruiser');
});

afterAll(async () => {
  await db?.close();
});

describe('0015 backfills the category of pre-0014 rows', () => {
  it('reads every legacy row as a car before the backfill', async () => {
    expect(await categoryOf(ids.bike)).toBe('car');
    expect(await categoryOf(ids.heavy)).toBe('car');
    expect(await categoryOf(ids.car)).toBe('car');

    const cars = await search({ category: 'car' });
    expect(cars).toEqual(expect.arrayContaining([BIKE, HEAVY, CAR]));
  });

  it('moves only the prefixed-brand rows', async () => {
    await db.exec(BACKFILL);

    expect(await categoryOf(ids.bike)).toBe('motorcycle');
    expect(await categoryOf(ids.heavy)).toBe('heavy');
    expect(await categoryOf(ids.car)).toBe('car');
  });

  it('puts them on /motorcycles and /heavy with no republish', async () => {
    const bikes = await search({ category: 'motorcycle' });
    const heavy = await search({ category: 'heavy' });
    const cars = await search({ category: 'car' });

    expect(bikes).toContain(BIKE);
    expect(bikes).not.toContain(HEAVY);
    expect(heavy).toContain(HEAVY);
    expect(heavy).not.toContain(BIKE);
    expect(cars).not.toContain(BIKE);
    expect(cars).toContain(CAR);
  });

  it('is idempotent and never overrides a stored category', async () => {
    await db.exec(BACKFILL);

    expect(await categoryOf(ids.bike)).toBe('motorcycle');
    expect(await categoryOf(ids.heavy)).toBe('heavy');
    expect(await categoryOf(ids.car)).toBe('car');
  });
});
