import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asAnonymous, asSuper, createDb, IDS } from './helpers/pg';

/**
 * Hosted motorcycle and heavy-machinery pages.
 *
 * Before 0014 a hosted vehicle could only be a car: `vehicles` had no category
 * or specs and `listing_cards` hid the condition facts 0008 stored, so
 * /motorcycles and /heavy could only ever serve the seeded catalogue and every
 * hosted category filter came back empty. These tests drive the real SQL (all
 * migrations on PGlite) with the same filter payload the route sends, proving
 * the narrowing happens in Postgres rather than in the browser.
 */

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => {
  await db?.close();
});

interface VehicleInput {
  category?: 'car' | 'motorcycle' | 'heavy';
  bodyType?: string | null;
  engineCc?: number | null;
  bikeType?: string | null;
  heavyType?: string | null;
  workingHours?: number | null;
  brand: string;
  model: string;
  thirdPartyInsurance?: boolean | null;
  bodyInsurance?: boolean | null;
  paintCondition?: string | null;
  chassisCondition?: string | null;
  technicalInspection?: boolean | null;
}

const created: string[] = [];

async function addVehicle(input: VehicleInput): Promise<string> {
  const result = await db.query<{ id: string }>(
    `insert into public.vehicles
       (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition, plate_type,
        category, body_type, engine_cc, bike_type, heavy_type, working_hours,
        third_party_insurance, body_insurance, paint_condition, chassis_condition,
        technical_inspection)
     values ($1, $2, $3, 1402, 1000, 'automatic', 'petrol', 'white', 'used', 'standard',
             $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     returning id`,
    [
      IDS.alice,
      input.brand,
      input.model,
      input.category ?? 'car',
      input.bodyType ?? null,
      input.engineCc ?? null,
      input.bikeType ?? null,
      input.heavyType ?? null,
      input.workingHours ?? null,
      input.thirdPartyInsurance ?? null,
      input.bodyInsurance ?? null,
      input.paintCondition ?? null,
      input.chassisCondition ?? null,
      input.technicalInspection ?? null,
    ],
  );
  const id = result.rows[0]!.id;
  created.push(id);
  return id;
}

async function addListing(slug: string, vehicleId: string, priceIrr = 10_000_000_000): Promise<void> {
  await db.query(
    `insert into public.listings
       (slug, created_by, vehicle_id, kind, price_irr, city, description, state,
        allow_phone_reveal, published_at)
     values ($1, $2, $3, 'vehicle', $4, 'kish', 'تست موتور و ماشین سنگین', 'active', true, now())`,
    [slug, IDS.alice, vehicleId, priceIrr],
  );
}

/** The RPC call the web route makes, with the same jsonb payload shape. */
async function search(filters: Record<string, unknown>, limit = 100): Promise<string[]> {
  const result = await db.query<{ slug: string }>(
    `select slug from public.search_listings($1::jsonb, $2)`,
    [JSON.stringify(filters), limit],
  );
  return result.rows.map((row) => row.slug);
}

const BIKE_SPORT = 'hosted-bike-sport-900';
const BIKE_ELECTRIC = 'hosted-bike-electric-scooter';
const HEAVY_EXCAVATOR = 'hosted-heavy-excavator';
const HEAVY_TRUCK = 'hosted-heavy-truck';
const CAR_SUV = 'hosted-car-suv';

beforeAll(async () => {
  if (!db) return;
  await addListing(
    BIKE_SPORT,
    await addVehicle({
      category: 'motorcycle',
      engineCc: 900,
      bikeType: 'sport',
      brand: 'bmw',
      model: 'S 1000 RR',
      technicalInspection: false,
    }),
  );
  await addListing(
    BIKE_ELECTRIC,
    await addVehicle({
      category: 'motorcycle',
      bikeType: 'scooter',
      brand: 'bmw',
      model: 'CE 04',
    }),
  );
  await addListing(
    HEAVY_EXCAVATOR,
    await addVehicle({
      category: 'heavy',
      heavyType: 'excavator',
      workingHours: 9_800,
      brand: 'caterpillar',
      model: '320D',
    }),
  );
  await addListing(
    HEAVY_TRUCK,
    await addVehicle({
      category: 'heavy',
      heavyType: 'truck',
      workingHours: 42_000,
      brand: 'volvo',
      model: 'FH16',
    }),
  );
  await addListing(
    CAR_SUV,
    await addVehicle({
      category: 'car',
      bodyType: 'suv',
      brand: 'toyota',
      model: 'Land Cruiser',
      thirdPartyInsurance: true,
      bodyInsurance: true,
      paintCondition: 'factory',
      chassisCondition: 'sealed',
      technicalInspection: true,
    }),
  );
});

describe('/motorcycles and /heavy filter server-side', () => {
  it('scopes /motorcycles to motorcycle rows only', async () => {
    const slugs = await search({ category: 'motorcycle' });

    expect(slugs.sort()).toEqual([BIKE_ELECTRIC, BIKE_SPORT].sort());
    expect(slugs).not.toContain(CAR_SUV);
    expect(slugs).not.toContain(HEAVY_EXCAVATOR);
  });

  it('scopes /heavy to heavy machinery only', async () => {
    const slugs = await search({ category: 'heavy' });

    expect(slugs.sort()).toEqual([HEAVY_EXCAVATOR, HEAVY_TRUCK].sort());
    expect(slugs).not.toContain(CAR_SUV);
    expect(slugs).not.toContain(BIKE_SPORT);
  });

  it('filters bikes by class and displacement inside /motorcycles', async () => {
    expect(await search({ category: 'motorcycle', bikeType: 'sport' })).toEqual([BIKE_SPORT]);
    expect(await search({ category: 'motorcycle', bikeType: 'scooter' })).toEqual([
      BIKE_ELECTRIC,
    ]);
    expect(await search({ category: 'motorcycle', engineCcMin: 500 })).toEqual([BIKE_SPORT]);
    // An electric bike has no displacement and ranks as 0 cc, exactly like the
    // client predicate; a >500cc ask still leaves it out.
    expect(await search({ category: 'motorcycle', engineCcMax: 500 })).toEqual([BIKE_ELECTRIC]);
  });

  it('filters heavy machinery by class and working hours inside /heavy', async () => {
    expect(await search({ category: 'heavy', heavyType: 'excavator' })).toEqual([
      HEAVY_EXCAVATOR,
    ]);
    expect(await search({ category: 'heavy', workingHoursMax: 10_000 })).toEqual([
      HEAVY_EXCAVATOR,
    ]);
    expect(await search({ category: 'heavy', heavyType: 'truck', workingHoursMax: 50_000 })).toEqual(
      [HEAVY_TRUCK],
    );
    expect(await search({ category: 'heavy', workingHoursMax: 100 })).toEqual([]);
  });

  it('does not let a bike or heavy filter leak into /cars', async () => {
    // Seeds read as cars (the additive default) plus the hosted SUV.
    const cars = await search({ category: 'car' });
    expect(cars).toContain(CAR_SUV);
    expect(cars).not.toContain(BIKE_SPORT);
    expect(cars).not.toContain(HEAVY_EXCAVATOR);

    // A stale category-specific filter only constrains its own category.
    expect(await search({ category: 'car', bikeType: 'sport' })).toContain(CAR_SUV);
    expect(await search({ category: 'car', engineCcMin: 500 })).toContain(CAR_SUV);
    expect(await search({ category: 'car', heavyType: 'excavator' })).toContain(CAR_SUV);
    expect(await search({ category: 'car', workingHoursMax: 100 })).toContain(CAR_SUV);
  });

  it('filters by body class on the hosted catalogue', async () => {
    expect(await search({ category: 'car', bodyType: 'suv' })).toEqual([CAR_SUV]);
    expect(await search({ category: 'car', bodyType: 'sedan' })).toEqual([]);
  });

  it('filters by the condition facts listing_cards used to hide', async () => {
    expect(await search({ insurance: 'third_party' })).toEqual([CAR_SUV]);
    expect(await search({ insurance: 'body' })).toEqual([CAR_SUV]);
    expect(await search({ paintCondition: 'factory' })).toEqual([CAR_SUV]);
    expect(await search({ chassisCondition: 'sealed' })).toEqual([CAR_SUV]);
    expect(await search({ technicalInspection: 'yes' })).toEqual([CAR_SUV]);
    expect(await search({ technicalInspection: 'no' })).toEqual([BIKE_SPORT]);
    expect(await search({ category: 'motorcycle', paintCondition: 'factory' })).toEqual([]);
  });

  it('exposes category, specs and condition facts on listing_cards', async () => {
    const bike = await db.query<Record<string, unknown>>(
      `select category, engine_cc, bike_type, heavy_type, working_hours, technical_inspection
       from public.listing_cards where slug = $1`,
      [BIKE_SPORT],
    );
    expect(bike.rows[0]).toEqual({
      category: 'motorcycle',
      engine_cc: 900,
      bike_type: 'sport',
      heavy_type: null,
      working_hours: null,
      technical_inspection: false,
    });

    const heavy = await db.query<Record<string, unknown>>(
      `select category, heavy_type, working_hours from public.listing_cards where slug = $1`,
      [HEAVY_EXCAVATOR],
    );
    expect(heavy.rows[0]).toEqual({
      category: 'heavy',
      heavy_type: 'excavator',
      working_hours: 9_800,
    });

    const car = await db.query<Record<string, unknown>>(
      `select body_type, third_party_insurance, paint_condition, chassis_condition
       from public.listing_cards where slug = $1`,
      [CAR_SUV],
    );
    expect(car.rows[0]).toEqual({
      body_type: 'suv',
      third_party_insurance: true,
      paint_condition: 'factory',
      chassis_condition: 'sealed',
    });
  });

  it('keeps legacy rows on /cars and leaves the unfiltered search intact', async () => {
    const legacy = await db.query<{ category: string }>(
      `select category from public.listing_cards where slug = 'peugeot-206-showroom'`,
    );
    expect(legacy.rows[0]!.category).toBe('car');

    // Both switched-off category pages stay empty; the default search still
    // returns the seeded catalogue plus the new hosted rows.
    expect(await search({})).toHaveLength(13);
    const unfiltered = await search({}, 100);
    expect(unfiltered).toEqual(expect.arrayContaining([CAR_SUV, BIKE_SPORT, HEAVY_EXCAVATOR]));
  });

  it('serves the same categories to anonymous visitors', async () => {
    await asAnonymous(db);
    try {
      expect((await search({ category: 'motorcycle' })).sort()).toEqual(
        [BIKE_ELECTRIC, BIKE_SPORT].sort(),
      );
      expect(await search({ category: 'heavy', heavyType: 'excavator' })).toEqual([
        HEAVY_EXCAVATOR,
      ]);
    } finally {
      await asSuper(db);
    }
  });
});
