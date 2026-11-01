import { MAX_PHOTOS, type ListingPhoto } from '@alisales/schemas';

/**
 * Photo storage rules (pure — no Supabase/Next imports, so tests can load it).
 *
 * Uploads land under `{sellerId}/{uuid}.webp`:
 *  - hosted: the public `listing-photos` bucket (0004 allows writes only inside
 *    the caller's own folder),
 *  - fixture mode: `.dev-data/photos/` served by `/api/photos/...`.
 *
 * Because the folder is the seller id, the publish/patch routes can prove a
 * submitted path belongs to the caller instead of trusting the browser.
 */

export const PHOTO_BUCKET = 'listing-photos';

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

/** Public URL for a stored object; null without a Supabase project URL. */
export function publicPhotoUrl(
  path: string,
  projectUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!path || !projectUrl) return null;
  return `${projectUrl.replace(/\/$/, '')}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

/** Fixture-mode URL for a stored object (served by the photos route). */
export function devPhotoUrl(path: string): string {
  return `/api/photos/${path}`;
}
