import { MAX_PHOTO_BYTES, ALLOWED_PHOTO_MIME } from '@alisales/schemas';

/**
 * Client-side listing photo pipeline (spec §6 / storage migration header):
 *
 *   pick → decode (EXIF orientation applied) → downscale (max edge 1600)
 *        → re-encode WebP (canvas holds pixels only, so **all** EXIF metadata
 *          — GPS, serials, timestamps — is dropped by construction)
 *        → enforce ≤ 8 MB (one quality retry) → upload → storage path
 *
 * Validation of the *set* (≤ 20 photos, unique positions, ≥ 1 to publish) is
 * the shared @alisales/schemas rule set — enforced again on the server route.
 */

export const MAX_EDGE_PX = 1600;
const WEBP_QUALITY = 0.85;
const WEBP_RETRY_QUALITY = 0.6;

export interface ProcessedPhoto {
  /** Null for photos that already live in storage (edit form initial set). */
  blob: Blob | null;
  /** Object URL for the preview — callers must revoke when the photo is removed. */
  previewUrl: string;
  width: number;
  height: number;
  bytes: number;
  /** Storage path from `POST /api/photos`; null until the upload succeeds. */
  path: string | null;
  /** Servable URL (Supabase public URL, or `/api/photos/...` in fixture mode). */
  url: string | null;
}

export class PhotoPipelineError extends Error {}

function ensureSupportedMime(file: File): void {
  if (!file.type || !(ALLOWED_PHOTO_MIME as readonly string[]).includes(file.type)) {
    throw new PhotoPipelineError('فرمت عکس پشتیبانی نمی‌شود (JPG، PNG یا WebP).');
  }
}

async function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  );
  if (!blob) throw new PhotoPipelineError('تبدیل عکس به WebP در این مرورگر ممکن نیست.');
  return blob;
}

export async function processListingPhoto(file: File): Promise<ProcessedPhoto> {
  ensureSupportedMime(file);
  if (file.size === 0) throw new PhotoPipelineError('فایل عکس خالی است.');

  let bitmap: ImageBitmap;
  try {
    // imageOrientation: 'from-image' bakes EXIF rotation into the pixels before
    // the metadata itself is discarded by the canvas re-encode below.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoPipelineError('خواندن فایل عکس ممکن نیست؛ فایل دیگری انتخاب کنید.');
  }

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new PhotoPipelineError('پردازش تصویر در این مرورگر در دسترس نیست.');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = await encodeCanvas(canvas, WEBP_QUALITY);
  if (blob.size > MAX_PHOTO_BYTES) {
    // One retry at lower quality before giving up (huge panoramas).
    blob = await encodeCanvas(canvas, WEBP_RETRY_QUALITY);
  }
  if (blob.size > MAX_PHOTO_BYTES) {
    throw new PhotoPipelineError('حجم عکس حتی پس از فشرده‌سازی بیش از حد مجاز است.');
  }

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    width,
    height,
    bytes: blob.size,
    path: null,
    url: null,
  };
}

/**
 * Upload the compressed bytes and attach the durable path.
 *
 * The bytes leave the browser exactly once; everything after this point refers
 * to the returned storage path, so the publish payload never carries image
 * data.
 */
export async function uploadProcessedPhoto(photo: ProcessedPhoto): Promise<ProcessedPhoto> {
  if (!photo.blob) throw new PhotoPipelineError('فایل عکس در دسترس نیست؛ دوباره انتخاب کنید.');
  const form = new FormData();
  form.append('file', photo.blob, 'photo.webp');
  form.append('width', String(photo.width));
  form.append('height', String(photo.height));

  let res: Response;
  try {
    res = await fetch('/api/photos', { method: 'POST', body: form });
  } catch {
    throw new PhotoPipelineError('ارتباط با سرور برای بارگذاری عکس برقرار نشد.');
  }

  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    path?: string;
    url?: string;
    error?: string;
  } | null;

  if (!res.ok || !body?.path) {
    throw new PhotoPipelineError(body?.error ?? 'بارگذاری عکس ناموفق بود؛ دوباره تلاش کنید.');
  }
  return { ...photo, path: body.path, url: body.url ?? null };
}
