import { randomUUID } from 'node:crypto';
import { admin } from './s2-store';
import { readBytes, writeBytes } from '../storage/demo-store';
import { PHOTO_BUCKET, devPhotoUrl } from './photo-rules';

/**
 * Server-side photo storage.
 *
 * The browser compresses to WebP (EXIF stripped, ≤ 8 MB) and POSTs the bytes to
 * `/api/photos`; this module is the only place that touches storage:
 *  - hosted: the public `photos` bucket via the service role (RLS bypassed by
 *    the service key), path `{sellerId}/{uuid}.webp`, public URL returned for
 *    rendering,
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

const EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/**
 * ASCII extension for the stored object name.
 *
 * The browser's filename is never used (it can hold Persian text, spaces or
 * an extension that disagrees with the bytes); an unexpected type — an
 * `application/octet-stream` from a file manager — still gets a safe extension
 * instead of failing the upload.
 *
 * HEIC has no entry on purpose: `/api/photos` answers 415 for it, so no object
 * ever needs a `.heic` name (the fallback would still produce one if something
 * bypassed the route).
 */
function extensionFor(mime: string): string {
  const known = EXT[mime];
  if (known) return known;
  const subtype = (mime.split('/')[1] ?? '').toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(subtype) ? subtype : 'bin';
}

/** Storage's "missing bucket" answer: a 404, or a message naming the bucket. */
function missingBucket(error: { message?: string; status?: number }): boolean {
  const message = (error.message ?? '').toLowerCase();
  return (
    error.status === 404 ||
    (message.includes('bucket') &&
      (message.includes('not found') ||
        message.includes('not exist') ||
        message.includes('does not exist')))
  );
}

function bucketAlreadyExists(message: string | undefined): boolean {
  return /already exists|duplicate|resource.*exist/i.test(message ?? '');
}

export async function storePhoto(input: PhotoBytes): Promise<StoredPhoto> {
  // The extension drives the served content type, so a clip is stored as a
  // clip instead of a `.webp` whose bytes are an MP4. The timestamp prefix
  // keeps objects listed in upload order for storage browsing/cleanup.
  const path = `${input.sellerId}/${Date.now()}-${randomUUID()}.${extensionFor(input.mime)}`;
  const sb = admin();

  if (sb) {
    // A Blob keeps the upload on storage-js's multipart path and carries the
    // real content type; the object path is unique, so it can be cached hard.
    // The bytes go up exactly as received: no server-side re-encode, so a
    // phone image can never fail on an image-optimizer or `sharp` error — the
    // browser already normalised what it could. (What it cannot normalise,
    // HEIC, never gets this far: the route refuses it.)
    const body = new Blob([new Uint8Array(input.bytes)], { type: input.mime });
    const upload = () =>
      sb.storage.from(PHOTO_BUCKET).upload(path, body, {
        contentType: input.mime,
        cacheControl: '31536000',
        upsert: false,
      });

    let uploaded = await upload();
    if (uploaded.error && missingBucket(uploaded.error)) {
      // A fresh project (or a deploy that skipped migration 0018) has no
      // `photos` bucket; create the public bucket once and retry instead of
      // answering 500 on the seller's first upload.
      const created = await sb.storage.createBucket(PHOTO_BUCKET, { public: true });
      if (created.error && !bucketAlreadyExists(created.error.message)) {
        throw new Error(
          `photo bucket «${PHOTO_BUCKET}» is missing and could not be created: ${created.error.message}`,
        );
      }
      uploaded = await upload();
    }
    if (uploaded.error) {
      // Log the provider's reason (missing bucket, size limit, network) — the
      // browser only ever sees the generic Persian message from the route.
      console.warn(
        `[alisales] photo upload to «${PHOTO_BUCKET}» failed for ${path}:`,
        uploaded.error.message,
      );
      throw new Error(`photo upload failed: ${uploaded.error.message}`);
    }
    const url = sb.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
    if (!url) throw new Error('photo upload returned no public URL');
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
    ext === 'png'
      ? 'image/png'
      : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'mp4'
          ? 'video/mp4'
          : ext === 'webm'
            ? 'video/webm'
            : ext === 'mov'
              ? 'video/quicktime'
              : 'image/webp';
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return { bytes: copy.buffer, mime };
}
