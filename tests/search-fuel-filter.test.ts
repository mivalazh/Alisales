import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, type SearchFilters } from '@alisales/schemas';
import type { PGlite } from '@electric-sql/pglite';
import { matchesFilters } from '../apps/web/lib/filter-match';
import { createDb, IDS } from './helpers/pg';

/**
 * `fuel` is a drawer filter in `FilterSystem.tsx`, it serialises into the RPC
 * payload, and the client predicate matches it — but no `search_listings`
 * version ever filtered on it (0002 and 0014 both omit it). 0017 adds the
 * predicate. These tests prove the RPC now honours it and that it selects the
 * same rows as `matchesFilters`, the predicate the grid uses.
 */

let db: PGlite;

const CARS = [
  { key: 'petrol', slug: 'fuel-petrol', fuel: 'petrol' },
  { key: 'hybrid', slug: 'fuel-hybrid', fuel: 'hybrid' },
  { key: 'electric', slug: 'fuel-electric', fuel: 'electric' },
];

async function addCar(slug: string, fuel: string): Promise<void> {
  const inserted = await db.query<{ id: string }>(
    `insert into public.vehicles
       (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition, plate_type)
     values ($1, 'toyota', 'Camry', 1402, 1000, 'automatic', $2::fuel_type, 'white', 'used', 'kish')
     returning id`,
    [IDS.alice, fuel],
  );
  await db.query(
    `insert into public.listings
       (slug, created_by, vehicle_id, kind, price_irr, city, description, state,
        allow_phone_reveal, published_at)
     values ($1, $2, $3, 'vehicle', 10_000_000_000, 'kish', 'ردیف سوخت', 'active', true, now())`,
    [slug, IDS.alice, inserted.rows[0]!.id],
  );
}

async function search(filters: Record<string, unknown>): Promise<string[]> {
  const result = await db.query<{ slug: string }>(
    `select slug from public.search_listings($1::jsonb, 100)`,
    [JSON.stringify(filters)],
  );
  return result.rows.map((row) => row.slug);
}

/** The same visible rows, narrowed by the shared client predicate instead. */
async function clientMatches(filters: SearchFilters): Promise<string[]> {
  const result = await db.query<Record<string, unknown>>(
    `select c.id, c.slug, c.city, c.brand, c.model, c.trim, c.year, c.price_irr,
            c.mileage_km, c.gearbox, c.fuel, c.plate_type, c.condition, c.has_report
       from public.listing_cards c
      where public.is_listing_public(c.id)`,
  );
  const rows = result.rows.map((row) => ({
    ...row,
    priceIRR: Number(row.price_irr),
    mileageKm: Number(row.mileage_km),
    hasReport: Boolean(row.has_report),
    plateType: String(row.plate_type),
  })) as unknown as Parameters<typeof matchesFilters>[0][];
  return rows.filter((row) => matchesFilters(row, filters)).map((row) => row.slug as string);
}

/** RPC payloads carry the city as the CSV string the URL codec serialises. */
const KISH = { city: 'kish' } as const;

beforeAll(async () => {
  db = await createDb();
  for (const car of CARS) await addCar(car.slug, car.fuel);
});

afterAll(async () => {
  await db?.close();
});

describe('0017 search_listings honours fuel', () => {
  it('returns only the requested fuel', async () => {
    const hybrid = await search({ ...KISH, fuel: 'hybrid' });

    expect(hybrid).toContain('fuel-hybrid');
    expect(hybrid).not.toContain('fuel-petrol');
    expect(hybrid).not.toContain('fuel-electric');
  });

  it('accepts a CSV of fuels, like every other multi-select filter', async () => {
    const electric = await search({ ...KISH, fuel: 'hybrid,electric' });

    expect(electric).toEqual(expect.arrayContaining(['fuel-hybrid', 'fuel-electric']));
    expect(electric).not.toContain('fuel-petrol');
  });

  it('leaves all fuels in an unfiltered search', async () => {
    const all = await search(KISH);

    expect(all).toEqual(expect.arrayContaining(CARS.map((car) => car.slug)));
  });

  it('selects the same rows as the client predicate', async () => {
    for (const fuel of [['hybrid'], ['hybrid', 'electric'], ['petrol']] as const) {
      const payload = { ...KISH, fuel: fuel.join(',') };
      const filters = { ...DEFAULT_FILTERS, city: ['kish'], fuel: [...fuel] };

      const sql = await search(payload);
      const client = await clientMatches(filters);

      expect(new Set(sql), fuel.join(',')).toEqual(new Set(client));
    }
  });
});
