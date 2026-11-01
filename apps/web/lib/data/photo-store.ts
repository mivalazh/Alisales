import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { randomUUID } from 'node:crypto';
import { admin } from './s2-store';
import { PHOTO_BUCKET, devPhotoUrl } from './photo-rules';

/**
 * Server-side photo storage.
 *
 * The browser compresses to WebP (EXIF stripped, ≤ 8 MB) and POSTs the bytes to
 * `/api/photos`; this module is the only place that touches storage:
 *  - hosted: `listing-photos` bucket via the service role, path
 *    `{sellerId}/{uuid}.webp`, public URL returned for rendering,
 *  - fixture mode: the same path shape under `.dev-data/photos`, served by the
 *    GET route so the offline catalog shows real images instead of placeholders.
 *
 * Bytes never enter the listing payload — the publish route only stores paths,
 * which it checks against the seller's own folder.
 */

const DEV_DIR = join(process.cwd(), '.dev-data', 'photos');

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

  const file = devPhotoFile(path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, input.bytes);
  return { path, url: devPhotoUrl(path) };
}

/** Absolute path for a fixture-mode object — refuses anything outside .dev-data/photos. */
export function devPhotoFile(path: string): string {
  const resolved = normalize(join(DEV_DIR, path));
  if (!resolved.startsWith(`${normalize(DEV_DIR)}${process.platform === 'win32' ? '\\' : '/'}`)) {
    throw new Error('invalid photo path');
  }
  return resolved;
}

export function readDevPhoto(path: string): { bytes: ArrayBuffer; mime: string } | null {
  let file: string;
  try {
    file = devPhotoFile(path);
  } catch {
    return null;
  }
  if (!existsSync(file)) return null;
  const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
  const mime =
    ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/webp';
  // Slice to a plain ArrayBuffer: a Node Buffer view is not a valid Response body.
  const buffer = readFileSync(file);
  return { bytes: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, mime };
}
