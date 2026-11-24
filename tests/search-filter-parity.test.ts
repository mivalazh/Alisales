import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  filtersToRpcPayload,
  parseFilterQueryString,
  serializeFilters,
  type SearchFilters,
} from '@alisales/schemas';
import type { PGlite } from '@electric-sql/pglite';
import { matchesFilters, type FilterableListing } from '../apps/web/lib/filter-match';
import { createDb, IDS } from './helpers/pg';

/**
 * One table, two implementations, one answer.
 *
 * The catalogue has two filter implementations that must agree: the
 * `search_listings` RPC (the hosted grid, and the mobile app) and the shared
 * `matchesFilters` predicate (the client filter preview and the credential-less
 * grid). They drifted silently once: `fuel` was wired through the drawer, the
 * URL and the client predicate but no RPC version ever filtered on it, so a
 * hosted `/cars?fuel=hybrid` shipped every fuel.
 *
 * This file runs the real SQL against a fixture catalogue and compares the
 * returned row sets with the client predicate for every filter key and value
 * shape — single value, CSV multi-select, range bounds, a value that matches
 * nothing, and a category-specific value left over in the URL. A missing or
 * wrong predicate fails the diff instead of reaching a buyer.
 *
 * The filters make the round trip production makes — `serializeFilters` →
 * `parseFilterQueryString` → `filtersToRpcPayload` / `matchesFilters` — so the
 * URL codec is covered too, and a key that exists in `SearchFilters` without a
 * parity case fails the coverage test.
 */

const MIGRATIONS = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));

/** The newest migration that defines `search_listings`. */
function latestSearchSql(): string {
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .reverse();
  for (const file of files) {
    const sql = readFileSync(MIGRATIONS + file, 'utf8');
    // The opening paren keeps `search_listings_page` (0020) out of this match:
    // that function returns a jsonb envelope, not `setof listing_cards`.
    if (sql.includes('function public.search_listings(')) return sql;
  }
  throw new Error('no migration defines public.search_listings');
}

const SEARCH_SQL = latestSearchSql();

/** A vehicle row as the publish path writes it. */
interface VehicleSpec {
  slug: string;
  brand: string;
  model: string;
  trim?: string | null;
  year: number;
  price: number;
  mileage: number;
  /** ISO timestamp is not needed; ordering never affects a filter result. */
  gearbox?: string;
  fuel?: string;
  color?: string;
  condition?: string;
  plate?: string;
  city?: string;
  description?: string;
  category?: 'car' | 'motorcycle' | 'heavy';
  bodyType?: string | null;
  engineCc?: number | null;
  bikeType?: string | null;
  heavyType?: string | null;
  workingHours?: number | null;
  thirdPartyInsurance?: boolean | null;
  bodyInsurance?: boolean | null;
  paintCondition?: string | null;
  chassisCondition?: string | null;
  technicalInspection?: boolean | null;
  /** Attach a finalized inspection report, so `has_report` is true. */
  report?: boolean;
}

/**
 * Cars only, with the body class stored explicitly.
 *
 * A car whose class has to be inferred from the model is deliberately absent:
 * SQL reads the column and the predicate infers, and 0016 closes that gap by
 * writing the inference into the column. `documents the body inference gap`
 * below pins that difference instead of hiding it in this table.
 */
const CARS: VehicleSpec[] = [
  {
    slug: 'parity-suv-toyota',
    brand: 'toyota',
    model: 'Land Cruiser VXR',
    trim: 'VXR',
    year: 1402,
    price: 30_000_000_000,
    mileage: 96_000,
    plate: 'kish',
    city: 'kish',
    bodyType: 'suv',
    thirdPartyInsurance: true,
    bodyInsurance: false,
    paintCondition: 'factory',
    chassisCondition: 'sealed',
    technicalInspection: true,
  },
  {
    slug: 'parity-suv-nissan',
    brand: 'nissan',
    model: 'Patrol Platinum',
    trim: 'Platinum',
    year: 1401,
    price: 25_000_000_000,
    mileage: 120_000,
    plate: 'standard',
    city: 'tehran',
    color: 'black',
    bodyType: 'suv',
    paintCondition: 'minor_scratches',
    chassisCondition: 'front_damaged',
    technicalInspection: false,
  },
  {
    slug: 'parity-sedan-toyota',
    brand: 'toyota',
    model: 'Camry GLX',
    trim: 'GLX',
    year: 1403,
    price: 18_000_000_000,
    mileage: 0,
    fuel: 'hybrid',
    condition: 'new',
    plate: 'kish',
    city: 'kish',
    bodyType: 'sedan',
    thirdPartyInsurance: true,
    bodyInsurance: true,
    paintCondition: 'factory',
    chassisCondition: 'sealed',
    technicalInspection: true,
  },
  {
    slug: 'parity-sedan-honda',
    brand: 'honda',
    model: 'Accord Touring',
    year: 1400,
    price: 12_000_000_000,
    mileage: 150_000,
    gearbox: 'cvt',
    color: 'silver',
    plate: 'standard',
    city: 'tehran',
    bodyType: 'sedan',
    thirdPartyInsurance: false,
    bodyInsurance: false,
    paintCondition: 'full_repaint',
    chassisCondition: 'rear_damaged',
  },
  {
    slug: 'parity-hatchback-kia',
    brand: 'kia',
    model: 'Picanto',
    year: 1399,
    price: 5_000_000_000,
    mileage: 40_000,
    gearbox: 'manual',
    fuel: 'cng',
    color: 'red',
    plate: 'temporary_transit',
    city: 'kish',
    bodyType: 'hatchback',
  },
  {
    slug: 'parity-coupe-ford',
    brand: 'ford',
    model: 'Mustang GT',
    year: 1398,
    price: 20_000_000_000,
    mileage: 30_000,
    color: 'blue',
    plate: 'unplated',
    city: 'kish',
    bodyType: 'coupe',
    report: true,
  },
  {
    slug: 'parity-sedan-zephyr',
    brand: 'toyota',
    model: 'Zephyr 7000',
    year: 1395,
    price: 8_000_000_000,
    mileage: 80_000,
    color: 'white',
    plate: 'standard',
    city: 'tehran',
    bodyType: 'sedan',
    description: 'خودروی کلکسیونی، بدون تصادف.',
  },
];

/** Category-specific specs: displacement/class/hours must only narrow their own lot. */
const BIKES: VehicleSpec[] = [
  {
    slug: 'parity-bike-sport',
    brand: 'bike-yamaha',
    model: 'MT-09',
    year: 1402,
    price: 4_000_000_000,
    mileage: 12_000,
    gearbox: 'manual',
    color: 'black',
    plate: 'unplated',
    city: 'kish',
    category: 'motorcycle',
    engineCc: 890,
    bikeType: 'sport',
  },
  {
    slug: 'parity-bike-electric',
    brand: 'bike-niu',
    model: 'NQi GT',
    year: 1403,
    price: 900_000_000,
    mileage: 3_000,
    fuel: 'electric',
    color: 'white',
    plate: 'unplated',
    city: 'tehran',
    category: 'motorcycle',
    // Electric bikes have no displacement: the range filter must rank them as 0 cc.
    engineCc: null,
    bikeType: 'electric',
  },
];

const HEAVY: VehicleSpec[] = [
  {
    slug: 'parity-truck',
    brand: 'heavy-volvo',
    model: 'FH 460',
    year: 1396,
    price: 92_000_000_000,
    mileage: 480_000,
    gearbox: 'manual',
    fuel: 'diesel',
    color: 'white',
    plate: 'standard',
    city: 'kish',
    category: 'heavy',
    heavyType: 'truck',
    workingHours: 9_800,
  },
  {
    slug: 'parity-crane',
    brand: 'heavy-caterpillar',
    model: 'CAT 320',
    year: 1394,
    price: 60_000_000_000,
    mileage: 12_000,
    fuel: 'diesel',
    color: 'orange',
    plate: 'standard',
    city: 'tehran',
    category: 'heavy',
    heavyType: 'crane',
    workingHours: 6_500,
  },
];

/** One part, so a vehicle-only filter can never pull it into a vehicle page. */
const PART = {
  slug: 'parity-part-brake',
  price: 2_000_000,
  city: 'kish',
  title: 'Brake Pad Front',
  category: 'brake',
  origin: 'original',
  condition: 'new',
  compatibility: 'Toyota Camry',
  warranty: '6 months',
  description: 'لنت ترمز جلو، اورجینال.',
} as const;

let db: PGlite;

async function insertVehicle(spec: VehicleSpec): Promise<string> {
  const inserted = await db.query<{ id: string }>(
    `insert into public.vehicles
       (created_by, brand, model, trim, year, mileage_km, gearbox, fuel, color,
        condition, plate_type, category, body_type, engine_cc, bike_type,
        heavy_type, working_hours, third_party_insurance, body_insurance,
        paint_condition, chassis_condition, technical_inspection)
     values ($1, $2, $3, $4, $5, $6, $7::gearbox_type, $8::fuel_type,
             $9::color_slug, $10::vehicle_condition, $11::plate_type, $12, $13,
             $14, $15, $16, $17, $18, $19, $20, $21, $22)
     returning id`,
    [
      IDS.alice,
      spec.brand,
      spec.model,
      spec.trim ?? null,
      spec.year,
      spec.mileage,
      spec.gearbox ?? 'automatic',
      spec.fuel ?? 'petrol',
      spec.color ?? 'white',
      spec.condition ?? 'used',
      spec.plate ?? 'standard',
      spec.category ?? 'car',
      spec.bodyType ?? null,
      spec.engineCc ?? null,
      spec.bikeType ?? null,
      spec.heavyType ?? null,
      spec.workingHours ?? null,
      spec.thirdPartyInsurance ?? null,
      spec.bodyInsurance ?? null,
      spec.paintCondition ?? null,
      spec.chassisCondition ?? null,
      spec.technicalInspection ?? null,
    ],
  );
  return inserted.rows[0]!.id;
}

async function insertListing(
  slug: string,
  vehicleId: string | null,
  price: number,
  city: string,
  description: string,
): Promise<string> {
  const inserted = await db.query<{ id: string }>(
    `insert into public.listings
       (slug, created_by, vehicle_id, kind, price_irr, city, description, state,
        allow_phone_reveal, published_at)
     values ($1, $2, $3, $4, $5, $6, $7, 'active', true, now())
     returning id`,
    [slug, IDS.alice, vehicleId, vehicleId ? 'vehicle' : 'part', price, city, description],
  );
  return inserted.rows[0]!.id;
}

/** The RPC call the web route makes for one URL state. */
async function sqlMatches(filters: SearchFilters): Promise<string[]> {
  const result = await db.query<{ slug: string }>(
    `select slug from public.search_listings($1::jsonb, 100)`,
    [JSON.stringify(filtersToRpcPayload(filters))],
  );
  return result.rows.map((row) => row.slug).sort();
}

interface CardRow {
  slug: string;
  city: string;
  brand: string;
  model: string;
  trim: string | null;
  year: number;
  price_irr: number | string;
  mileage_km: number;
  gearbox: string;
  fuel: string;
  color: string;
  condition: string;
  plate_type: string;
  has_report: boolean;
  kind: string;
  category: string | null;
  body_type: string | null;
  engine_cc: number | null;
  bike_type: string | null;
  heavy_type: string | null;
  working_hours: number | null;
  third_party_insurance: boolean | null;
  body_insurance: boolean | null;
  paint_condition: string | null;
  chassis_condition: string | null;
  technical_inspection: boolean | null;
}

/** The view row as the grid's predicate sees it. */
function toListing(row: CardRow): FilterableListing {
  return {
    city: row.city,
    brand: row.brand,
    model: row.model,
    trim: row.trim,
    year: row.year,
    priceIRR: Number(row.price_irr),
    mileageKm: row.mileage_km,
    gearbox: row.gearbox,
    fuel: row.fuel,
    color: row.color,
    plateType: row.plate_type,
    condition: row.condition,
    hasReport: Boolean(row.has_report),
    category: row.kind === 'part' ? undefined : ((row.category ?? 'car') as 'car'),
    bodyType: (row.body_type as FilterableListing['bodyType']) ?? null,
    engineCc: row.engine_cc,
    bikeType: row.bike_type,
    heavyType: row.heavy_type,
    workingHours: row.working_hours,
    thirdPartyInsurance: row.third_party_insurance,
    bodyInsurance: row.body_insurance,
    paintCondition: row.paint_condition,
    chassisCondition: row.chassis_condition,
    technicalInspection: row.technical_inspection,
  };
}

/** The same visible rows the RPC sees, narrowed by the shared predicate. */
async function clientMatches(filters: SearchFilters): Promise<string[]> {
  const result = await db.query<CardRow>(
    `select c.* from public.listing_cards c where public.is_listing_public(c.id)`,
  );
  return result.rows
    .filter((row) => matchesFilters(toListing(row), filters))
    .map((row) => row.slug)
    .sort();
}

/**
 * Every filter key, and each value shape that has ever differed: single,
 * CSV multi-select, an open-ended range bound, a value that matches nothing,
 * a category-only value that must leave the other categories alone, and a
 * combined set.
 */
interface ParityCase {
  name: string;
  patch: Partial<SearchFilters>;
}

const CASES: ParityCase[] = [
  { name: 'no filters', patch: {} },
  { name: 'city — single', patch: { city: ['tehran'] } },
  { name: 'city — CSV multi', patch: { city: ['kish', 'tehran'] } },
  { name: 'kish only', patch: { kishOnly: true } },
  { name: 'brand — single', patch: { brand: ['toyota'] } },
  { name: 'brand — CSV multi', patch: { brand: ['toyota', 'nissan'] } },
  { name: 'brand — no matching row', patch: { brand: ['porsche'] } },
  { name: 'body class — single', patch: { bodyType: ['suv'] } },
  { name: 'body class — CSV multi', patch: { bodyType: ['sedan', 'coupe'] } },
  { name: 'body class — no matching row', patch: { bodyType: ['van'] } },
  { name: 'model substring', patch: { model: 'patrol' } },
  { name: 'trim substring', patch: { trim: 'vxr' } },
  { name: 'year — lower bound', patch: { yearFrom: 1401 } },
  { name: 'year — upper bound', patch: { yearTo: 1400 } },
  { name: 'year — both bounds on the same year', patch: { yearFrom: 1402, yearTo: 1402 } },
  { name: 'price — lower bound', patch: { priceFrom: 20_000_000_000 } },
  { name: 'price — upper bound', patch: { priceTo: 5_500_000_000 } },
  { name: 'price — closed range', patch: { priceFrom: 5_000_000_000, priceTo: 20_000_000_000 } },
  { name: 'mileage — lower bound', patch: { mileageMin: 100_000 } },
  { name: 'mileage — upper bound', patch: { mileageMax: 40_000 } },
  { name: 'gearbox — CSV multi', patch: { gearbox: ['manual', 'cvt'] } },
  { name: 'fuel — single', patch: { fuel: ['hybrid'] } },
  { name: 'fuel — CSV multi', patch: { fuel: ['petrol', 'electric'] } },
  { name: 'fuel — CSV multi across fuels', patch: { fuel: ['hybrid', 'cng'] } },
  { name: 'plate type — CSV multi', patch: { plateType: ['kish', 'temporary_transit'] } },
  { name: 'condition — new only', patch: { condition: ['new'] } },
  { name: 'insurance — third party', patch: { insurance: ['third_party'] } },
  { name: 'insurance — both policies', patch: { insurance: ['third_party', 'body'] } },
  { name: 'paint — CSV multi', patch: { paintCondition: ['factory', 'full_repaint'] } },
  { name: 'chassis — sealed only', patch: { chassisCondition: ['sealed'] } },
  { name: 'inspection — yes', patch: { technicalInspection: 'yes' } },
  { name: 'inspection — no', patch: { technicalInspection: 'no' } },
  { name: 'displacement — lower bound', patch: { engineCcMin: 600 } },
  { name: 'displacement — upper bound', patch: { engineCcMax: 400 } },
  { name: 'displacement — closed range', patch: { engineCcMin: 600, engineCcMax: 900 } },
  { name: 'bike class — sport', patch: { bikeType: ['sport'] } },
  { name: 'heavy class — truck', patch: { heavyType: ['truck'] } },
  { name: 'working hours ceiling', patch: { workingHoursMax: 10_000 } },
  { name: 'inspection report required', patch: { hasReport: true } },
  { name: 'query — model substring', patch: { q: 'zephyr' } },
  { name: 'query — brand substring', patch: { q: 'toyota' } },
  { name: 'combined filters', patch: { city: ['kish'], bodyType: ['sedan'], fuel: ['hybrid'] } },
  // A stale bike filter in the URL must never empty a car search (and vice versa).
  { name: 'bike class left over on a car search', patch: { brand: ['toyota'], bikeType: ['sport'] } },
  { name: 'displacement ceiling left over on cars', patch: { engineCcMax: 100 } },
];

beforeAll(async () => {
  db = await createDb();
  // The table owns its catalogue so every expected row set is explicit; the
  // seeded rows would only add noise to a diff. Children cascade from listings.
  await db.exec('delete from public.listings;');
  await db.exec('delete from public.vehicles;');

  for (const spec of [...CARS, ...BIKES, ...HEAVY]) {
    const vehicleId = await insertVehicle(spec);
    const listingId = await insertListing(
      spec.slug,
      vehicleId,
      spec.price,
      spec.city ?? 'kish',
      spec.description ?? 'ردیف تست برابری فیلترها.',
    );
    if (spec.report) {
      const report = await db.query<{ id: string }>(
        `insert into public.inspection_reports
           (inspector_id, brand, model, year, mileage_km, status, current_version)
         values ($1, $2, $3, $4, $5, 'finalized', 1)
         returning id`,
        [IDS.inspector, spec.brand, spec.model, spec.year, spec.mileage],
      );
      await db.query(`update public.listings set report_id = $1 where id = $2`, [
        report.rows[0]!.id,
        listingId,
      ]);
    }
  }

  const partListing = await insertListing(PART.slug, null, PART.price, PART.city, PART.description);
  await db.query(
    `insert into public.part_details
       (listing_id, category, title, origin, condition, compatibility, warranty)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      partListing,
      PART.category,
      PART.title,
      PART.origin,
      PART.condition,
      PART.compatibility,
      PART.warranty,
    ],
  );
});

afterAll(async () => {
  await db?.close();
});

describe('search_listings and matchesFilters agree', () => {
  for (const testCase of CASES) {
    it(`${testCase.name}`, async () => {
      const filters: SearchFilters = { ...DEFAULT_FILTERS, ...testCase.patch };

      // The URL codec production runs: a chip round-trips through the query
      // string before either side sees it, and an invalid value would silently
      // fall back to the unfiltered list and make this case meaningless.
      const roundTripped = parseFilterQueryString(serializeFilters(filters));
      expect(roundTripped, `${testCase.name}: filters must survive the URL codec`).toEqual(filters);

      expect(await sqlMatches(roundTripped)).toEqual(await clientMatches(roundTripped));
    });
  }

  it('exercises every SearchFilters key', () => {
    const covered = new Set<string>();
    for (const testCase of CASES) {
      for (const key of Object.keys(testCase.patch)) covered.add(key);
    }
    const missing = Object.keys(DEFAULT_FILTERS).filter((key) => !covered.has(key));
    expect(missing, 'add a parity case for every new filter key').toEqual([]);
  });
});

describe('documented client/server divergences', () => {
  /** Insert a one-off row, run both sides, and clean up. */
  async function withRow(
    spec: VehicleSpec,
    check: (filters: SearchFilters) => Promise<void>,
  ): Promise<void> {
    const vehicleId = await insertVehicle(spec);
    try {
      await insertListing(
        spec.slug,
        vehicleId,
        spec.price,
        spec.city ?? 'kish',
        spec.description ?? 'ردیف واگرایی.',
      );
      await check({ ...DEFAULT_FILTERS });
    } finally {
      await db.query(`delete from public.listings where slug = $1`, [spec.slug]);
      await db.query(`delete from public.vehicles where id = $1`, [vehicleId]);
    }
  }

  it('body inference: the browser guesses a class the stored column lacks (0016)', async () => {
    // The 0016 backfill exists for exactly this row: SQL reads the column, the
    // predicate infers from the model. Until the migration runs, /cars?bodyType=suv
    // misses it while the client preview counts it.
    await withRow(
      {
        slug: 'divergence-legacy-body',
        brand: 'toyota',
        model: 'Land Cruiser',
        year: 1401,
        price: 10_000_000_000,
        mileage: 50_000,
        bodyType: null,
      },
      async (base) => {
        const filters = { ...base, bodyType: ['suv' as const] };
        expect(await clientMatches(filters)).toContain('divergence-legacy-body');
        expect(await sqlMatches(filters)).not.toContain('divergence-legacy-body');
      },
    );
  });

  it('query: the RPC also searches the description, the predicate does not', async () => {
    await withRow(
      {
        slug: 'divergence-description-query',
        brand: 'kia',
        model: 'Sportage',
        year: 1402,
        price: 11_000_000_000,
        mileage: 20_000,
        description: 'سقف پانوراما و دوربین ۳۶۰.',
      },
      async (base) => {
        const filters = { ...base, q: 'پانوراما' };
        expect(await sqlMatches(filters)).toContain('divergence-description-query');
        expect(await clientMatches(filters)).not.toContain('divergence-description-query');
      },
    );
  });

  it('would catch a dropped RPC predicate (the 0017 fuel regression)', async () => {
    // Remove the fuel predicate from a copy of the live function: the table
    // above must notice. This is what makes the harness a regression test
    // rather than a snapshot of today's agreement.
    const fuelPredicate = /^\s*and \(v_fuel is null.*$/m;
    expect(SEARCH_SQL).toMatch(fuelPredicate);

    const filters: SearchFilters = { ...DEFAULT_FILTERS, fuel: ['hybrid'] };
    const expected = await clientMatches(filters);
    try {
      await db.exec(SEARCH_SQL.replace(fuelPredicate, ''));
      const broken = await sqlMatches(filters);
      expect(broken).not.toEqual(expected);
      expect(broken).toContain('parity-suv-toyota'); // petrol: the predicate is what excludes it
    } finally {
      await db.exec(SEARCH_SQL);
    }

    expect(await sqlMatches(filters)).toEqual(expected);
  });
});
