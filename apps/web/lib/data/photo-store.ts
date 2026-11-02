import { randomUUID } from 'node:crypto';
import { admin } from './s2-store';
import { readBytes, writeBytes } from '../storage/demo-store';
import { PHOTO_BUCKET, devPhotoUrl } from './photo-rules';

/**
 * Server-side photo storage.
 *
 * The browser compresses to WebP (EXIF stripped, ≤ 8 MB) and POSTs the bytes to
 * `/api/photos`; this module is the only place that touches storage:
 *  - hosted: `listing-photos` bucket via the service role, path
 *    `{sellerId}/{uuid}.webp`, public URL returned for rendering,
 *  - fixture mode: the same path shape in the demo store (`.dev-data/photos`,
 *    `/tmp/…`, or isolate memory on Workers), served by the GET route so the
 *    offline catalog shows real images instead of placeholders.
 *
 * Bytes never enter the listing payload — the publish route only stores paths,
 * which it checks against the seller's own folder.
 */

const PREFIX = 'photos';

export interface StoredPhoto {
  path: string;
  url: string;
}

export interface PhotoBytes {
  sellerId: string;
  bytes: Uint8Array;
  mime: string;
  width: number;
  height: number;
}

export async function storePhoto(input: PhotoBytes): Promise<StoredPhoto> {
  const path = `${input.sellerId}/${randomUUID()}.webp`;
  const sb = admin();

  if (sb) {
    const uploaded = await sb.storage
      .from(PHOTO_BUCKET)
      .upload(path, input.bytes, { contentType: input.mime, upsert: false });
    if (uploaded.error) {
      throw new Error(`photo upload failed: ${uploaded.error.message}`);
    }
    const url = sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
    return { path, url };
  }

  writeBytes(`${PREFIX}/${safePhotoPath(path)}`, input.bytes);
  return { path, url: devPhotoUrl(path) };
}

/**
 * Normalizes a fixture-mode object key and refuses anything outside
 * `photos/` — the same guard the disk implementation had, now path-separator
 * agnostic.
 */
function safePhotoPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  if (
    normalized.startsWith('/') ||
    normalized.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error('invalid photo path');
  }
  return normalized;
}

export function readDevPhoto(path: string): { bytes: ArrayBuffer; mime: string } | null {
  let key: string;
  try {
    key = `${PREFIX}/${safePhotoPath(path)}`;
  } catch {
    return null;
  }
  const bytes = readBytes(key);
  if (!bytes) return null;
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  const mime =
    ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return { bytes: copy.buffer, mime };
}
