import { AVATAR_EDGE_PX, COVER_EDGE_PX, MAX_PROFILE_MEDIA_BYTES } from './media-rules';

/**
 * Profile artwork pipeline — avatar and cover banner.
 *
 * Decode with EXIF rotation applied, downscale, re-encode WebP and hand the
 * compressed blob to the upload route. Metadata (GPS, serials) is dropped by
 * the canvas re-encode; the stored profile row keeps only the storage URL.
 *
 * iPhones hand `<input type="file">` a HEIC/HEIF file, which `createImageBitmap`
 * refuses on most browsers. Safari can still decode it through an `<img>`
 * element, so that is the fallback path: decode → draw to canvas → WebP. A
 * browser that cannot decode the file at all gets a clear error instead of a
 * silent failed upload.
 */

export { AVATAR_EDGE_PX, COVER_EDGE_PX };

/** Encoded quality for both avatar and cover. */
export const PROFILE_IMAGE_QUALITY = 0.82;

export interface ProfileImage {
  blob: Blob;
  width: number;
  height: number;
}

export class ProfileImageError extends Error {}

const HEIC_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);

function isHeic(file: File): boolean {
  return HEIC_TYPES.has(file.type.toLowerCase()) || /\.(heic|heif)$/i.test(file.name);
}

/** Decode through an `<img>`, which understands HEIC on iOS Safari. */
async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } catch {
    throw new ProfileImageError(
      'این فرمت تصویر (HEIC) در مرورگر شما باز نمی‌شود؛ از تنظیمات دوربین، JPEG را انتخاب کنید یا تصویر را از گالری به اشتراک بگذارید.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** One decoded source, normalised to a width/height + draw call. */
async function decode(
  file: File,
): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }> {
  // HEIC first: `createImageBitmap` never handles it in Chrome/Firefox, and
  // Safari's support is patchy, so the `<img>` path is the reliable one.
  if (isHeic(file)) {
    const image = await loadImageElement(file);
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(image, 0, 0, w, h),
    };
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => {
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
      },
    };
  } catch {
    // A mislabelled HEIC or an exotic still: let the browser's own decoder try.
    const image = await loadImageElement(file);
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(image, 0, 0, w, h),
    };
  }
}

export async function profileImageBlob(file: File, maxEdge: number): Promise<ProfileImage> {
  if (!file.type.startsWith('image/') && !isHeic(file)) {
    throw new ProfileImageError('فقط فایل تصویری مجاز است.');
  }
  if (file.size === 0) throw new ProfileImageError('فایل تصویری خالی است.');

  const source = await decode(file);
  if (!source.width || !source.height) {
    throw new ProfileImageError('خواندن فایل تصویر ممکن نیست؛ فایل دیگری انتخاب کنید.');
  }

  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new ProfileImageError('پردازش تصویر در این مرورگر در دسترس نیست.');
  }
  source.draw(ctx, width, height);

  let quality = PROFILE_IMAGE_QUALITY;
  let blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  );
  while (blob && blob.size > MAX_PROFILE_MEDIA_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );
  }
  if (!blob) throw new ProfileImageError('تبدیل تصویر به WebP ممکن نیست.');
  if (blob.size > MAX_PROFILE_MEDIA_BYTES) {
    throw new ProfileImageError('حجم تصویر بیش از حد مجاز است.');
  }
  return { blob, width, height };
}
