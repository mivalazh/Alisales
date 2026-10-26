import { MAX_PHOTO_BYTES, ALLOWED_PHOTO_MIME } from '@alisales/schemas';

/**
 * Client-side listing photo pipeline (spec §6 / storage migration header):
 *
 *   pick → decode (EXIF orientation applied) → downscale (max edge 1600)
 *        → re-encode WebP (canvas holds pixels only, so **all** EXIF metadata
 *          — GPS, serials, timestamps — is dropped by construction)
 *        → enforce ≤ 8 MB (one quality retry) → ready for preview/upload
 *
 * Validation of the *set* (≤ 20 photos, unique positions, ≥ 1 to publish) is
 * the shared @alisales/schemas rule set — enforced again on the server route.
 */

export const MAX_EDGE_PX = 1600;
const WEBP_QUALITY = 0.85;
const WEBP_RETRY_QUALITY = 0.6;

export interface ProcessedPhoto {
  blob: Blob;
  /** Object URL for the preview — callers must revoke when the photo is removed. */
  previewUrl: string;
  width: number;
  height: number;
  bytes: number;
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
  };
}
