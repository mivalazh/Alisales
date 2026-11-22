import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import {
  photoBucket,
  photoRowUrl,
  publicPhotoUrl,
} from '../apps/web/lib/data/photo-rules';
import { LISTINGS } from './helpers/pg';

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
