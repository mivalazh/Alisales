import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  ALLOWED_PHOTO_MIME,
  HEIC_PHOTO_MESSAGE,
  isHeicMime,
  listingPhotoSchema,
} from '@alisales/schemas';
import { LISTINGS, createDb } from './helpers/pg';

/**
 * HEIC is refused on purpose, at every layer that could otherwise accept it.
 *
 * The bytes cannot be decoded here: the browser re-encodes through a canvas
 * (no HEVC decoder in Chrome/Firefox/Android), the server stores exactly what
 * it receives, and the bundled libvips only reads AVIF inside a HEIF container
 * (`sharp.format.heif.input.fileSuffix` is `['.avif']`). Storing a HEIC would
 * therefore mean a cover the majority of visitors cannot paint.
 *
 * These tests pin the three answers a seller can meet — the picker, the route,
 * the column — and the sentence they get instead of a generic «unsupported
 * format».
 */

const storePhoto = vi.fn(async () => ({ path: 'seller/abc.webp', url: 'https://x/abc.webp' }));
vi.mock('@/lib/data/photo-store', () => ({ storePhoto: () => storePhoto() }));
vi.mock('@/lib/auth/session', () => ({ getSession: async () => ({ sub: 'seller-1' }) }));

const { POST } = await import('../apps/web/app/api/photos/route');

function upload(file: File, size = { width: 800, height: 600 }): Request {
  const form = new FormData();
  form.append('file', file);
  form.append('width', String(size.width));
  form.append('height', String(size.height));
  return new Request('http://localhost/api/photos', { method: 'POST', body: form });
}

describe('isHeicMime', () => {
  it('recognises the MIME types iOS and macOS produce', () => {
    expect(isHeicMime('image/heic')).toBe(true);
    expect(isHeicMime('image/heif')).toBe(true);
    expect(isHeicMime('IMAGE/HEIC')).toBe(true);
    expect(isHeicMime('image/heic-sequence')).toBe(true);
  });

  it('recognises a HEIC by name when the platform sends no type', () => {
    // File managers hand over `application/octet-stream`, or nothing at all.
    expect(isHeicMime('', 'IMG_0421.HEIC')).toBe(true);
    expect(isHeicMime('application/octet-stream', 'IMG_0421.heif')).toBe(true);
    expect(isHeicMime(null, 'IMG_0421.jpeg')).toBe(false);
  });

  it('leaves the supported types alone', () => {
    for (const mime of ALLOWED_PHOTO_MIME) {
      expect(isHeicMime(mime, `photo.${mime.split('/')[1]}`)).toBe(false);
    }
    expect(isHeicMime('video/mp4', 'clip.mp4')).toBe(false);
  });
});

describe('the photo schema keeps HEIC out of the payload', () => {
  it('does not list it as an allowed photo type', () => {
    expect(ALLOWED_PHOTO_MIME as readonly string[]).not.toContain('image/heic');
    const parsed = listingPhotoSchema.safeParse({
      path: 'seller/1.heic',
      mime: 'image/heic',
      bytes: 2048,
      width: 4032,
      height: 3024,
      position: 0,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('POST /api/photos', () => {
  it('answers 415 with the HEIC sentence and stores nothing', async () => {
    storePhoto.mockClear();
    const file = new File([new Uint8Array(2048)], 'IMG_0421.HEIC', { type: 'image/heic' });

    const response = await POST(upload(file));

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: HEIC_PHOTO_MESSAGE,
      code: 'heic_unsupported',
    });
    expect(storePhoto).not.toHaveBeenCalled();
  });

  it('catches a HEIC that arrives without a MIME type', async () => {
    storePhoto.mockClear();
    const file = new File([new Uint8Array(2048)], 'IMG_0421.heic', { type: '' });

    const response = await POST(upload(file));

    expect(response.status).toBe(415);
    expect(storePhoto).not.toHaveBeenCalled();
  });

  it('still accepts the WebP the client pipeline produces', async () => {
    storePhoto.mockClear();
    const file = new File([new Uint8Array(2048)], 'photo.webp', { type: 'image/webp' });

    const response = await POST(upload(file));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ ok: true, path: 'seller/abc.webp' });
    expect(storePhoto).toHaveBeenCalledTimes(1);
  });

  it('still answers 400 for a type nobody decodes', async () => {
    storePhoto.mockClear();
    const file = new File([new Uint8Array(2048)], 'scan.tiff', { type: 'image/tiff' });

    const response = await POST(upload(file));

    expect(response.status).toBe(400);
    expect(storePhoto).not.toHaveBeenCalled();
  });
});

describe('listing_photos keeps the narrow mime constraint', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDb();
  });
  afterAll(async () => {
    await db?.close();
  });

  it('rejects a HEIC row at the column', async () => {
    // Widening this constraint is only correct once something can read HEIC;
    // today it would let a row exist that no cover renderer can use.
    await expect(
      db.query(
        `insert into public.listing_photos (listing_id, storage_path, position, mime, bytes, width, height)
         values ($1, 'seller/heic.heic', 0, 'image/heic', 2048, 4032, 3024)`,
        [LISTINGS.alice206],
      ),
    ).rejects.toThrow(/check|constraint/i);
  });
});
