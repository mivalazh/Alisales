import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  MAX_PHOTOS,
  brandSlugs,
  listingPhotoSchema,
  searchFiltersSchema,
  vehicleSchema,
  BRANDS,
} from '@alisales/schemas';
import {
  devPhotoUrl,
  isOwnedPhotoPath,
  orderedPhotoRows,
  publicPhotoUrl,
} from '../apps/web/lib/data/photo-rules';
import { LISTINGS, createDb } from './helpers/pg';

const photo = (position: number, path = `seller/${position}.webp`) => ({
  path,
  mime: 'image/webp' as const,
  bytes: 1024,
  width: 800,
  height: 600,
  position,
});

const vehicleBase = {
  trim: null,
  year: 1402,
  mileageKm: 10_000,
  gearbox: 'automatic',
  fuel: 'petrol',
  color: 'white',
  condition: 'used',
  plateType: 'standard',
  vin: null,
} as const;

describe('luxury / Kish brand catalog (schema validation)', () => {
  const cases: Array<[string, string]> = [
    ['toyota', 'Land Cruiser'],
    ['toyota', 'Prado'],
    ['toyota', 'RAV4'],
    ['nissan', 'Patrol'],
    ['mercedes-benz', 'S-Class'],
    ['mercedes-benz', 'E-Class'],
    ['bmw', 'X5'],
    ['bmw', '5 Series'],
    ['kia', 'Sportage'],
    ['kia', 'Optima'],
    ['hyundai', 'Sonata'],
    ['lexus', 'LX'],
    ['porsche', 'Cayenne'],
    ['land-rover', 'Range Rover'],
    // the Iranian brands that existing data and tests depend on stay valid
    ['saipa', 'کوییک'],
    ['ikco', 'پژو ۲۰۶'],
  ];

  it.each(cases)('accepts %s / %s', (brand, model) => {
    const parsed = vehicleSchema.safeParse({ ...vehicleBase, brand, model });
    expect(parsed.success).toBe(true);
  });

  it('keeps every named luxury brand in the slug list', () => {
    for (const slug of [
      'toyota',
      'nissan',
      'mercedes-benz',
      'bmw',
      'kia',
      'hyundai',
      'lexus',
      'porsche',
      'land-rover',
      'saipa',
      'ikco',
    ]) {
      expect(brandSlugs).toContain(slug);
    }
  });

  it('offers the key models as form suggestions', () => {
    const models = (slug: string) =>
      BRANDS.find((b) => b.slug === slug)?.models as readonly string[] | undefined;
    expect(models('toyota')).toEqual(expect.arrayContaining(['Land Cruiser', 'Prado', 'RAV4']));
    expect(models('mercedes-benz')).toEqual(expect.arrayContaining(['S-Class', 'E-Class']));
    expect(models('bmw')).toEqual(expect.arrayContaining(['X5', '5 Series']));
    expect(models('kia')).toEqual(expect.arrayContaining(['Sportage', 'Optima']));
    expect(models('nissan')).toEqual(expect.arrayContaining(['Patrol']));
    expect(models('land-rover')).toEqual(expect.arrayContaining(['Range Rover']));
  });

  it('still rejects a brand that is not in the catalog', () => {
    const parsed = vehicleSchema.safeParse({ ...vehicleBase, brand: 'mercedes', model: 'S-Class' });
    expect(parsed.success).toBe(false);
  });

  it('keeps model free-text for imports (trim only)', () => {
    const parsed = vehicleSchema.safeParse({
      ...vehicleBase,
      brand: 'toyota',
      model: 'Land Cruiser VXR 2023',
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts the luxury brands in the search filter payload', () => {
    const brands = ['toyota', 'nissan', 'mercedes-benz', 'bmw', 'lexus', 'porsche', 'land-rover'];
    expect(searchFiltersSchema.parse({ brand: brands }).brand).toEqual(brands);
    expect(searchFiltersSchema.safeParse({ brand: ['tesla'] }).success).toBe(false);
  });
});

describe('photo rules', () => {
  it('orders rows by position and renumbers them 0..n-1', () => {
    const rows = orderedPhotoRows([photo(2, 's/c.webp'), photo(0, 's/a.webp'), photo(1, 's/b.webp')]);
    expect(rows.map((r) => r.storage_path)).toEqual(['s/a.webp', 's/b.webp', 's/c.webp']);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
    expect(rows[0]).toMatchObject({ mime: 'image/webp', bytes: 1024, width: 800, height: 600 });
  });

  it('keeps the cover at position 0 after a reorder', () => {
    const before = orderedPhotoRows([photo(0, 's/a.webp'), photo(1, 's/b.webp')]);
    // «کاور شود» on the second photo → it moves to position 0 in the UI state
    const after = orderedPhotoRows([photo(1, 's/a.webp'), photo(0, 's/b.webp')]);
    expect(before[0]!.storage_path).toBe('s/a.webp');
    expect(after[0]!.storage_path).toBe('s/b.webp');
    expect(after.map((r) => r.position)).toEqual([0, 1]);
  });

  it('caps a set at MAX_PHOTOS', () => {
    const many = Array.from({ length: MAX_PHOTOS + 2 }, (_, i) => photo(i % MAX_PHOTOS, `s/${i}.webp`));
    expect(orderedPhotoRows(many)).toHaveLength(MAX_PHOTOS);
  });

  it('only accepts paths inside the seller folder', () => {
    const seller = '11111111-1111-1111-1111-111111111111';
    expect(isOwnedPhotoPath(`${seller}/a.webp`, seller)).toBe(true);
    expect(isOwnedPhotoPath('22222222-2222-2222-2222-222222222222/a.webp', seller)).toBe(false);
    expect(isOwnedPhotoPath('pending/a.webp', seller)).toBe(false);
    expect(isOwnedPhotoPath(`${seller}/../other.webp`, seller)).toBe(false);
    expect(isOwnedPhotoPath(`${seller}/a.webp`, '')).toBe(false);
  });

  it('builds public and dev URLs', () => {
    expect(publicPhotoUrl('s/a.webp', 'https://x.supabase.co')).toBe(
      'https://x.supabase.co/storage/v1/object/public/listing-photos/s/a.webp',
    );
    expect(publicPhotoUrl('s/a.webp', 'https://x.supabase.co/')).toBe(
      'https://x.supabase.co/storage/v1/object/public/listing-photos/s/a.webp',
    );
    expect(publicPhotoUrl('s/a.webp', undefined)).toBeNull();
    expect(devPhotoUrl('s/a.webp')).toBe('/api/photos/s/a.webp');
  });

  it('rejects an out-of-range photo position at the schema level', () => {
    expect(listingPhotoSchema.safeParse(photo(MAX_PHOTOS)).success).toBe(false);
    expect(listingPhotoSchema.safeParse({ ...photo(0), mime: 'image/gif' }).success).toBe(false);
    expect(listingPhotoSchema.safeParse({ ...photo(0), bytes: 0 }).success).toBe(false);
  });
});

describe('listing_photos persistence (PGlite)', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
    await db.query(`delete from public.listing_photos where listing_id = $1`, [LISTINGS.alice206]);
  });
  afterAll(async () => {
    await db?.close();
  });

  async function insertPhoto(path: string, position: number): Promise<void> {
    await db.query(
      `insert into public.listing_photos (listing_id, storage_path, position, mime, bytes, width, height)
       values ($1, $2, $3, 'image/webp', 2048, 1200, 900)`,
      [LISTINGS.alice206, path, position],
    );
  }

  async function coverPath(): Promise<string | null> {
    const r = await db.query<{ cover_photo_path: string | null }>(
      `select cover_photo_path from public.listing_cards where id = $1`,
      [LISTINGS.alice206],
    );
    return r.rows[0]?.cover_photo_path ?? null;
  }

  it('stores an ordered set and exposes position 0 as the card cover', async () => {
    await insertPhoto('alice/a.webp', 0);
    await insertPhoto('alice/b.webp', 1);
    await insertPhoto('alice/c.webp', 2);

    const rows = await db.query<{ storage_path: string; position: number }>(
      `select storage_path, position from public.listing_photos
       where listing_id = $1 order by position`,
      [LISTINGS.alice206],
    );
    expect(rows.rows.map((r) => r.storage_path)).toEqual([
      'alice/a.webp',
      'alice/b.webp',
      'alice/c.webp',
    ]);
    expect(rows.rows.map((r) => r.position)).toEqual([0, 1, 2]);
    expect(await coverPath()).toBe('alice/a.webp');
  });

  it('follows a reorder (cover moves to the new position 0)', async () => {
    // Swap cover and third photo through a spare slot — the table enforces a
    // unique (listing_id, position), so a direct swap would collide.
    await db.query(
      `update public.listing_photos set position = 10 where listing_id = $1 and position = 0`,
      [LISTINGS.alice206],
    );
    await db.query(
      `update public.listing_photos set position = 0 where listing_id = $1 and position = 2`,
      [LISTINGS.alice206],
    );
    await db.query(
      `update public.listing_photos set position = 2 where listing_id = $1 and position = 10`,
      [LISTINGS.alice206],
    );

    expect(await coverPath()).toBe('alice/c.webp');
    const rows = await db.query<{ storage_path: string }>(
      `select storage_path from public.listing_photos where listing_id = $1 order by position`,
      [LISTINGS.alice206],
    );
    expect(rows.rows.map((r) => r.storage_path)).toEqual([
      'alice/c.webp',
      'alice/b.webp',
      'alice/a.webp',
    ]);
  });

  it('enforces the per-listing position uniqueness and 0..19 range', async () => {
    await expect(insertPhoto('alice/dup.webp', 1)).rejects.toThrow(/listing_photos_listing_id_position_key/);
    await expect(insertPhoto('alice/out-of-range.webp', 20)).rejects.toThrow(
      /listing_photos_position_check/,
    );
  });

  it('deletes photo rows with the listing (cascade)', async () => {
    const created = await db.query<{ id: string }>(
      `insert into public.vehicles (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition)
       values ('00000000-0000-0000-0000-00000000000c', 'toyota', 'Land Cruiser', 1401, 1000, 'automatic', 'petrol', 'white', 'used')
       returning id`,
    );
    const vehicleId = created.rows[0]!.id;
    const listing = await db.query<{ id: string }>(
      `insert into public.listings (slug, created_by, vehicle_id, price_irr, city, description, state)
       values ('photo-cascade-test', '00000000-0000-0000-0000-00000000000c', $1, 1000000, 'kish', 'تست حذف عکس‌ها با آگهی', 'active')
       returning id`,
      [vehicleId],
    );
    const listingId = listing.rows[0]!.id;
    await db.query(
      `insert into public.listing_photos (listing_id, storage_path, position, mime, bytes, width, height)
       values ($1, 'alice/cascade.webp', 0, 'image/webp', 1000, 800, 600)`,
      [listingId],
    );
    await db.query(`delete from public.listings where id = $1`, [listingId]);
    const left = await db.query<{ count: number }>(
      `select count(*)::int as count from public.listing_photos where listing_id = $1`,
      [listingId],
    );
    expect(left.rows[0]!.count).toBe(0);
  });

  it('accepts a luxury brand/model pair in the real vehicles table', async () => {
    const r = await db.query<{ brand: string; model: string }>(
      `insert into public.vehicles (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition)
       values ('00000000-0000-0000-0000-00000000000c', 'mercedes-benz', 'S-Class', 1399, 52000, 'automatic', 'petrol', 'silver', 'used')
       returning brand, model`,
    );
    expect(r.rows[0]).toEqual({ brand: 'mercedes-benz', model: 'S-Class' });
  });
});
