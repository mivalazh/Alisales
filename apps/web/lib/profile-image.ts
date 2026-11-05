/**
 * Profile artwork pipeline — avatar and cover banner.
 *
 * Same idea as the listing photo pipeline, with profile-sized targets: decode
 * (EXIF rotation applied), downscale, re-encode WebP as a data URL, so the
 * stored value is one short string and no upload endpoint is needed. Metadata
 * (GPS, serials) is dropped by the canvas re-encode.
 */

export const AVATAR_EDGE_PX = 320;
export const COVER_EDGE_PX = 1280;

export class ProfileImageError extends Error {}

export async function profileImageDataUrl(file: File, maxEdge: number): Promise<string> {
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
  let url = canvas.toDataURL('image/webp', quality);
  // Keep the stored string small: the API caps it at ~180 KB.
  while (url.length > 150_000 && quality > 0.4) {
    quality -= 0.12;
    url = canvas.toDataURL('image/webp', quality);
  }
  if (url.length > 240_000) throw new ProfileImageError('حجم تصویر بیش از حد مجاز است.');
  return url;
}
