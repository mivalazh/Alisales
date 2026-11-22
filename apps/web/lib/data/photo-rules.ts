import { MAX_PHOTOS, type ListingPhoto } from '@alisales/schemas';

/**
 * Photo storage rules (pure — no Supabase/Next imports, so tests can load it).
 *
 * Uploads land under `{sellerId}/{uuid}.webp`:
 *  - hosted: the public `photos` bucket (0018). The server writes with the
 *    service role, so storage RLS can never block an upload; the bucket stays
 *    public-read so a cover renders without a signed URL,
 *  - fixture mode: `.dev-data/photos/` served by `/api/photos/...`.
 *
 * Objects uploaded before the switch live in `listing-photos` (0004). Their
 * rows keep that bucket in `listing_photos.bucket` (0019) and are rendered
 * from it, so a cover never disappears because the bucket name changed.
 *
 * Because the folder is the seller id, the publish/patch routes can prove a
 * submitted path belongs to the caller instead of trusting the browser.
 */

export const PHOTO_BUCKET = 'photos';

/** Where every object uploaded before 0018 was written. */
export const LEGACY_PHOTO_BUCKET = 'listing-photos';

export const PHOTO_BUCKETS = [PHOTO_BUCKET, LEGACY_PHOTO_BUCKET] as const;

export type PhotoBucket = (typeof PHOTO_BUCKETS)[number];

/**
 * A stored bucket name, narrowed to a bucket that exists.
 *
 * Rows written before 0019 have no bucket (the column did not exist) and rows
 * written by an older client can carry anything; both mean «new uploads» — the
 * `photos` bucket — rather than an unrenderable URL.
 */
export function photoBucket(value: unknown): PhotoBucket {
  return typeof value === 'string' && (PHOTO_BUCKETS as readonly string[]).includes(value)
    ? (value as PhotoBucket)
    : PHOTO_BUCKET;
}

/** Legacy/local placeholder prefix — never a durable storage path. */
export const PENDING_PHOTO_PREFIX = 'pending/';

export function isOwnedPhotoPath(path: string, sellerId: string): boolean {
  if (!sellerId) return false;
  if (path.startsWith(PENDING_PHOTO_PREFIX)) return false;
  if (path.includes('..')) return false;
  return path.startsWith(`${sellerId}/`);
}

export interface PhotoRow {
  storage_path: string;
  position: number;
  mime: string;
  bytes: number;
  width: number;
  height: number;
}

/**
 * DB rows for a listing's photo set.
 *
 * The UI keeps the user's order in `position` (0 = cover, «کاور شود» moves a
 * photo to the front). Rows are sorted by that position and renumbered 0..n-1
 * so the stored order is gap-free — `listing_photos` has both a 0..19 check and
 * a `unique (listing_id, position)` constraint, which a sparse set would hit.
 */
export function orderedPhotoRows(photos: readonly ListingPhoto[]): PhotoRow[] {
  return [...photos]
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_PHOTOS)
    .map((p, index) => ({
      storage_path: p.path,
      position: index,
      mime: p.mime,
      bytes: p.bytes,
      width: p.width,
      height: p.height,
    }));
}

/**
 * Public URL for a stored object; null without a Supabase project URL.
 *
 * `bucket` is the bucket the object was written to: `photos` for new uploads,
 * `listing-photos` for anything uploaded before 0018. The prior default keeps
 * every existing two-argument call pointing at the new bucket.
 */
export function publicPhotoUrl(
  path: string,
  projectUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
  bucket: string | null | undefined = PHOTO_BUCKET,
): string | null {
  if (!path || !projectUrl) return null;
  return `${projectUrl.replace(/\/$/, '')}/storage/v1/object/public/${photoBucket(bucket)}/${path}`;
}

/** A `listing_photos` row, or the cover columns of `listing_cards`. */
export interface StoredPhotoRef {
  storage_path?: string | null;
  /** Owner-photo metadata calls the same value `path`. */
  path?: string | null;
  bucket?: string | null;
}

/**
 * Render URL for a stored photo row, using the bucket recorded with it.
 *
 * This is the one place that decides between the two buckets: a legacy row
 * resolves to `listing-photos`, a new one to `photos`.
 */
export function photoRowUrl(
  row: StoredPhotoRef,
  projectUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  return publicPhotoUrl(row.storage_path ?? row.path ?? '', projectUrl, row.bucket);
}

/** Fixture-mode URL for a stored object (served by the photos route). */
export function devPhotoUrl(path: string): string {
  return `/api/photos/${path}`;
}
