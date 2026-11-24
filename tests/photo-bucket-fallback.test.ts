import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import {
  photoBucket,
  photoRowUrl,
  publicPhotoUrl,
} from '../apps/web/lib/data/photo-rules';
import { createDb, LISTINGS } from './helpers/pg';

/**
 * 0018 moved new uploads to the public `photos` bucket, but every object
 * uploaded before it lives in `listing-photos`. Both have to keep rendering:
 * the bucket is recorded with the row (0019) and the URL builder follows it.
 */
const PROJECT = 'https://x.supabase.co';
const legacyUrl = (path: string) =>
  `${PROJECT}/storage/v1/object/public/listing-photos/${path}`;
const photosUrl = (path: string) => `${PROJECT}/storage/v1/object/public/photos/${path}`;

describe('photo URL resolution', () => {
  it('points new uploads at the photos bucket by default', () => {
    expect(publicPhotoUrl('seller/a.webp', PROJECT)).toBe(photosUrl('seller/a.webp'));
    expect(photoRowUrl({ storage_path: 'seller/a.webp' }, PROJECT)).toBe(
      photosUrl('seller/a.webp'),
    );
    expect(publicPhotoUrl('seller/a.webp', PROJECT, 'photos')).toBe(
      photosUrl('seller/a.webp'),
    );
  });

  it('resolves a path stored in the old listing-photos bucket', () => {
    expect(publicPhotoUrl('seller/a.webp', PROJECT, 'listing-photos')).toBe(
      legacyUrl('seller/a.webp'),
    );
    expect(
      photoRowUrl({ path: 'seller/a.webp', bucket: 'listing-photos' }, PROJECT),
    ).toBe(legacyUrl('seller/a.webp'));
  });

  it('never builds a URL for an unknown or missing bucket', () => {
    expect(photoBucket('listing-photos')).toBe('listing-photos');
    expect(photoBucket('photos')).toBe('photos');
    // Rows written before the column existed (or by an old client) fall back to
    // the current upload bucket instead of an unrenderable URL.
    expect(photoBucket(undefined)).toBe('photos');
    expect(photoBucket(null)).toBe('photos');
    expect(photoBucket('someone-elses-bucket')).toBe('photos');
  });

  it('still returns null without a Supabase project URL', () => {
    expect(publicPhotoUrl('seller/a.webp', undefined, 'listing-photos')).toBeNull();
    expect(photoRowUrl({ path: 'seller/a.webp', bucket: 'listing-photos' }, undefined)).toBeNull();
  });
});

/**
 * The migration itself, on a database that was populated *before* it ran: the
 * row has no bucket column yet, exactly like a hosted row from before 0019.
 */
describe('0019 backfills legacy rows and exposes the cover bucket', () => {
  const MIGRATIONS_DIR = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
  const readRoot = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    // Everything up to 0018, then the seeds, then a photo row as the old
    // publish path wrote it — no bucket column exists at this point.
    for (const file of files.filter((file) => file < '0019')) {
      await db.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
    }
    await db.exec(readRoot('supabase/seed.sql'));
    await db.exec(readRoot('supabase/seed_fixtures.sql'));

    await db.exec(`delete from public.listing_photos where listing_id = '${LISTINGS.alice206}'`);
    await db.query(
      `insert into public.listing_photos (listing_id, storage_path, position, mime, bytes, width, height)
       values ($1, 'alice/legacy-cover.webp', 0, 'image/webp', 2048, 1200, 900)`,
      [LISTINGS.alice206],
    );

    // Now the migration under test.
    await db.exec(readFileSync(`${MIGRATIONS_DIR}0019_photo_bucket.sql`, 'utf8'));
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it('marks every pre-existing row as living in listing-photos', async () => {
    const { rows } = await db.query<{ storage_path: string; bucket: string }>(
      `select storage_path, bucket from public.listing_photos where listing_id = $1`,
      [LISTINGS.alice206],
    );
    expect(rows).toEqual([
      { storage_path: 'alice/legacy-cover.webp', bucket: 'listing-photos' },
    ]);
  });

  it('defaults new rows to the photos bucket', async () => {
    await db.query(
      `insert into public.listing_photos (listing_id, storage_path, position, mime, bytes, width, height)
       values ($1, 'alice/new-photo.webp', 1, 'image/webp', 1024, 800, 600)`,
      [LISTINGS.alice206],
    );
    const { rows } = await db.query<{ storage_path: string; bucket: string }>(
      `select storage_path, bucket from public.listing_photos
       where listing_id = $1 and storage_path = 'alice/new-photo.webp'`,
      [LISTINGS.alice206],
    );
    expect(rows).toEqual([{ storage_path: 'alice/new-photo.webp', bucket: 'photos' }]);
  });

  it('exposes the cover bucket on listing_cards, so the cover URL resolves', async () => {
    const { rows } = await db.query<{
      cover_photo_path: string;
      cover_photo_bucket: string;
    }>(
      `select cover_photo_path, cover_photo_bucket
       from public.listing_cards where id = $1`,
      [LISTINGS.alice206],
    );

    expect(rows).toEqual([
      { cover_photo_path: 'alice/legacy-cover.webp', cover_photo_bucket: 'listing-photos' },
    ]);
    // What `mapRow` does with the same two columns.
    expect(
      photoRowUrl(
        { storage_path: rows[0]!.cover_photo_path, bucket: rows[0]!.cover_photo_bucket },
        PROJECT,
      ),
    ).toBe(legacyUrl('alice/legacy-cover.webp'));
  });
});

/**
 * Editing re-inserts the whole photo set, so a kept photo's bucket has to be
 * carried over explicitly: without it the column default (`photos`) would move
 * a legacy object to a bucket that has no such file, and the cover would 404.
 */
describe('editing photos keeps each row in its own bucket', () => {
  const LISTING_ID = 'listing-1';
  const SELLER = 'seller-1';
  const photo = (path: string, position: number) => ({
    path: `${SELLER}/${path}`,
    mime: 'image/webp' as const,
    bytes: 2048,
    width: 1200,
    height: 900,
    position,
  });
  const previousRows = [
    {
      storage_path: `${SELLER}/legacy.webp`,
      bucket: 'listing-photos',
      position: 0,
      mime: 'image/webp',
      bytes: 2048,
      width: 1200,
      height: 900,
    },
  ];

  const inserted: Array<Record<string, unknown>> = [];
  const deleted: string[] = [];

  beforeEach(() => {
    inserted.length = 0;
    deleted.length = 0;
    vi.resetModules();
    vi.doMock('../apps/web/lib/data/s2-store', () => ({
      admin: () => ({
        from: (table: string) => ({
          select: () => ({
            eq: (column: string, value: string) => {
              if (table === 'listings') {
                expect([column, value]).toEqual(['id', LISTING_ID]);
                return {
                  maybeSingle: async () => ({
                    data: { id: LISTING_ID, created_by: SELLER },
                    error: null,
                  }),
                };
              }
              return Promise.resolve({ data: previousRows, error: null });
            },
          }),
          delete: () => ({
            eq: async (column: string, value: string) => {
              deleted.push(`${table}:${column}=${value}`);
              return { error: null };
            },
          }),
          insert: async (rows: Array<Record<string, unknown>>) => {
            inserted.push(...rows);
            return { error: null };
          },
        }),
      }),
    }));
  });

  afterEach(() => {
    vi.doUnmock('../apps/web/lib/data/s2-store');
  });

  it('keeps a legacy photo in listing-photos when its row is re-inserted', async () => {
    const { updateHostedListing } = await import('../apps/web/lib/data/publish-store');

    const result = await updateHostedListing({
      id: LISTING_ID,
      sellerId: SELLER,
      patch: { photos: [photo('legacy.webp', 0), photo('new.webp', 1)] },
    });

    expect(result).toEqual({ ok: true });
    expect(deleted).toEqual([`listing_photos:listing_id=${LISTING_ID}`]);
    expect(inserted.map((row) => row.storage_path)).toEqual([
      `${SELLER}/legacy.webp`,
      `${SELLER}/new.webp`,
    ]);
    // The kept photo keeps the bucket it was uploaded to (0019) …
    expect(inserted[0]).toMatchObject({ bucket: 'listing-photos', position: 0 });
    // … while a new upload omits the column, so its `photos` default applies.
    expect(inserted[1]).not.toHaveProperty('bucket');
  });
});

/**
 * The card path, not just the URL helper.
 *
 * `listingById` maps a `listing_cards` row to a card, and that is what the
 * saved-listings lookup, favorites, chat, moderation and the admin queues
 * render. A cover whose object lives in the old bucket must come out pointing
 * at `listing-photos`; resolving it against the `photos` default would 404
 * every image uploaded before 0018.
 */
describe('a legacy cover survives the card mapper', () => {
  // `publicPhotoUrl` defaults `projectUrl` to NEXT_PUBLIC_SUPABASE_URL, so the
  // public URL the mapper builds needs that name set, not just SUPABASE_URL.
  const ENV_KEYS = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
  ] as const;
  const savedEnv = new Map<string, string | undefined>();

  const cardRow = (bucket?: string | null) => ({
    id: 'listing-1',
    slug: 'toyota-camry-kish',
    seller_id: 'seller-1',
    price_irr: '10000000000',
    city: 'kish',
    state: 'active',
    featured: false,
    published_at: null,
    has_report: false,
    brand: 'toyota',
    model: 'Camry',
    trim: null,
    year: 1402,
    mileage_km: 1000,
    gearbox: 'automatic',
    fuel: 'petrol',
    color: 'white',
    condition: 'used',
    plate_type: 'kish',
    cover_photo_path: 'seller-1/legacy-cover.webp',
    ...(bucket === undefined ? {} : { cover_photo_bucket: bucket }),
  });

  beforeEach(() => {
    for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
    process.env.SUPABASE_URL = PROJECT;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = PROJECT;
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@supabase/supabase-js');
    for (const key of ENV_KEYS) {
      const value = savedEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    savedEnv.clear();
  });

  function serveRow(row: Record<string, unknown>): void {
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
          }),
        }),
      }),
    }));
  }

  it('resolves a cover stored in listing-photos against that bucket', async () => {
    serveRow(cardRow('listing-photos'));
    const { listingById } = await import('../apps/web/lib/data/s2-store');

    const card = await listingById('listing-1');

    expect(card?.coverUrl).toBe(legacyUrl('seller-1/legacy-cover.webp'));
    // Path-level check: `/listing-photos/` also contains the literal «photos»,
    // so compare the whole public-object path instead of a substring.
    expect(new URL(card!.coverUrl!).pathname).toBe(
      '/storage/v1/object/public/listing-photos/seller-1/legacy-cover.webp',
    );
  });

  it('keeps a new upload on the photos bucket', async () => {
    serveRow(cardRow('photos'));
    const { listingById } = await import('../apps/web/lib/data/s2-store');

    expect((await listingById('listing-1'))?.coverUrl).toBe(
      photosUrl('seller-1/legacy-cover.webp'),
    );
  });

  it('builds the URL from SUPABASE_URL when the public name is unset', async () => {
    // A deployment configured with server credentials only can still upload;
    // its covers must still resolve rather than render as placeholders.
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    serveRow(cardRow('listing-photos'));
    const { listingById } = await import('../apps/web/lib/data/s2-store');

    expect((await listingById('listing-1'))?.coverUrl).toBe(
      legacyUrl('seller-1/legacy-cover.webp'),
    );
  });

  it('treats a row without a bucket (pre-0019 view) as a new upload', async () => {
    // The 0019 backfill labels every pre-existing row, so an unlabelled row can
    // only come from a project that has not applied it; the upload bucket is
    // then the only bucket that can hold the object.
    serveRow(cardRow());
    const { listingById } = await import('../apps/web/lib/data/s2-store');

    expect((await listingById('listing-1'))?.coverUrl).toBe(
      photosUrl('seller-1/legacy-cover.webp'),
    );
  });
});

/**
 * 0021 — the data-level half of the fallback.
 *
 * 0019's backfill is a guess: «everything that existed when this ran is
 * legacy». A row can also arrive without its bucket at all, taking the `photos`
 * default while its object sits in `listing-photos`. Rebuilding the URL from the
 * row is only as good as that label, so 0021 asks `storage.objects` where the
 * object actually is and corrects the label when the two disagree — without it
 * a legacy path still resolves against a bucket that has no such file.
 */
describe('0021 reconciles a wrong bucket label with the storage inventory', () => {
  const MIGRATIONS_DIR = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));

  /** Only in the old bucket, but the row says `photos`. */
  const LEGACY_ONLY = 'alice/legacy-only.webp';
  /** Only in the current bucket, but the row says `listing-photos`. */
  const NEW_ONLY = 'alice/new-only.webp';
  /** Copied by scripts/copy-legacy-photos.mjs: either URL works. */
  const IN_BOTH = 'alice/in-both.webp';
  /** No object at all (fixture rows, objects deleted outside the app). */
  const IN_NEITHER = 'alice/in-neither.webp';

  let db: PGlite;

  const storedBuckets = async (): Promise<Record<string, string>> => {
    const { rows } = await db.query<{ storage_path: string; bucket: string }>(
      `select storage_path, bucket from public.listing_photos
       where listing_id = $1 order by position`,
      [LISTINGS.alice206],
    );
    return Object.fromEntries(rows.map((row) => [row.storage_path, row.bucket]));
  };

  beforeAll(async () => {
    db = await createDb();

    // Seed a listing whose rows disagree with the bucket inventory, exactly the
    // way an object uploaded between 0018 and 0019 (or an older client's
    // insert) leaves it.
    await db.query(`delete from public.listing_photos where listing_id = $1`, [LISTINGS.alice206]);
    await db.query(
      `insert into storage.objects (bucket_id, name) values
         ('listing-photos', $1),
         ('photos', $2),
         ('photos', $3),
         ('listing-photos', $3)`,
      [LEGACY_ONLY, NEW_ONLY, IN_BOTH],
    );
    await db.query(
      `insert into public.listing_photos
         (listing_id, storage_path, bucket, position, mime, bytes, width, height)
       values
         ($1, $2, 'photos', 0, 'image/webp', 2048, 1200, 900),
         ($1, $3, 'listing-photos', 1, 'image/webp', 2048, 1200, 900),
         ($1, $4, 'photos', 2, 'image/webp', 2048, 1200, 900),
         ($1, $5, 'listing-photos', 3, 'image/webp', 2048, 1200, 900)`,
      [LISTINGS.alice206, LEGACY_ONLY, NEW_ONLY, IN_BOTH, IN_NEITHER],
    );

    await db.exec(readFileSync(`${MIGRATIONS_DIR}0021_photo_bucket_trueup.sql`, 'utf8'));
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it('moves a row to the bucket its object is actually in, and only then', async () => {
    expect(await storedBuckets()).toEqual({
      [LEGACY_ONLY]: 'listing-photos',
      [NEW_ONLY]: 'photos',
      // Both URLs resolve, so the stored label stands.
      [IN_BOTH]: 'photos',
      // No URL resolves, so flipping the label would only churn rows.
      [IN_NEITHER]: 'listing-photos',
    });
  });

  it('makes a legacy path resolve to a URL again', async () => {
    const buckets = await storedBuckets();
    expect(photoRowUrl({ storage_path: LEGACY_ONLY, bucket: buckets[LEGACY_ONLY] }, PROJECT)).toBe(
      legacyUrl(LEGACY_ONLY),
    );
  });

  it('is idempotent', async () => {
    const before = await storedBuckets();
    await db.exec(readFileSync(`${MIGRATIONS_DIR}0021_photo_bucket_trueup.sql`, 'utf8'));
    expect(await storedBuckets()).toEqual(before);
  });

  it('does nothing on a database that never applied 0019', async () => {
    const bare = new PGlite();
    try {
      await bare.exec(`
        create table public.listing_photos (
          listing_id uuid,
          storage_path text not null,
          position int not null
        );
      `);
      await bare.exec(readFileSync(`${MIGRATIONS_DIR}0021_photo_bucket_trueup.sql`, 'utf8'));
      const { rows } = await bare.query(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'listing_photos'
           and column_name = 'bucket'`,
      );
      expect(rows).toEqual([]);
    } finally {
      await bare.close();
    }
  });
});
