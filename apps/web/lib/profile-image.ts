import { AVATAR_EDGE_PX, COVER_EDGE_PX, MAX_PROFILE_MEDIA_BYTES } from './media-rules';

/**
 * Profile artwork pipeline — avatar and cover banner.
 *
 * Decode with EXIF rotation applied, downscale, re-encode WebP and hand the
 * compressed blob to the upload route. Metadata (GPS, serials) is dropped by
 * the canvas re-encode; the stored profile row keeps only the storage URL.
 */

export { AVATAR_EDGE_PX, COVER_EDGE_PX };

export interface ProfileImage {
  blob: Blob;
  width: number;
  height: number;
}

export class ProfileImageError extends Error {}

export async function profileImageBlob(file: File, maxEdge: number): Promise<ProfileImage> {
  if (!file.type.startsWith('image/')) {
    throw new ProfileImageError('فقط فایل تصویری مجاز است.');
  }
  if (file.size === 0) throw new ProfileImageError('فایل تصویری خالی است.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ProfileImageError('خواندن فایل تصویر ممکن نیست؛ فایل دیگری انتخاب کنید.');
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new ProfileImageError('پردازش تصویر در این مرورگر در دسترس نیست.');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.84;
  let blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality),
  );
  while (blob && blob.size > MAX_PROFILE_MEDIA_BYTES && quality > 0.4) {
    quality -= 0.12;
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
