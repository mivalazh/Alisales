import {
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  ALLOWED_PHOTO_MIME,
  ALLOWED_VIDEO_MIME,
  type ListingPhoto,
} from '@alisales/schemas';

/**
 * Client-side listing photo pipeline (spec §6 / storage migration header):
 *
 *   pick → decode (EXIF orientation applied, HEIC/HEIF converted to pixels)
 *        → downscale (max edge 1280) → re-encode WebP, or JPEG for an iPhone
 *          HEIC/HEIF (canvas holds pixels only, so **all** EXIF metadata —
 *          GPS, serials, timestamps — is dropped by construction)
 *        → ~150–350 KB at quality 0.8 → enforce ≤ 8 MB (one quality retry)
 *        → upload → storage path
 *
 * Compressing before the request is what keeps a phone photo off Vercel's
 * 4.5 MB body limit (and off a slow LTE upload) instead of failing at the edge.
 *
 * Validation of the *set* (≤ 20 photos, unique positions, ≥ 1 to publish) is
 * the shared @alisales/schemas rule set — enforced again on the server route.
 */

export const MAX_EDGE_PX = 1280;
/** Target quality of the canvas re-encode (WebP, or JPEG for HEIC stills). */
const IMAGE_QUALITY = 0.8;
const RETRY_QUALITY = 0.6;
/** A mobile upload that has not answered in this long is reported, not hung. */
const UPLOAD_TIMEOUT_MS = 60_000;

/**
 * Shown when a HEIC reaches a browser with no HEVC decoder (Chrome, Firefox,
 * Android): the file is fine, the browser cannot re-encode it. Safari — the
 * browser an iPhone user actually has — converts it before this can fire.
 */
const HEIC_CONVERT_FAILED =
  'تبدیل عکس HEIC در این مرورگر ممکن نیست؛ با Safari عکس را انتخاب کنید یا آن را به JPG تبدیل کنید.';

export interface ProcessedPhoto {
  /** Media class — the cover slot only accepts `image`. */
  kind: 'image' | 'video';
  /** MIME actually uploaded (WebP, JPEG for a converted HEIC, the clip's own type for video). */
  mime: ListingPhoto['mime'];
  /** Null for media that already lives in storage (edit form initial set). */
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

/**
 * HEIC/HEIF stills — the iPhone and macOS default.
 *
 * Recognised by MIME *and* by filename: some platforms hand over a HEIC with
 * no MIME at all, or `application/octet-stream`.
 */
const HEIC_MIMES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

function isHeic(file: File): boolean {
  if (HEIC_MIMES.has((file.type || '').toLowerCase())) return true;
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

function ensureSupportedMime(file: File): void {
  // HEIC/HEIF is accepted now: an iPhone hands it over by default and the
  // canvas converts it to JPEG below. Everything else must be a raster format
  // the canvas can read back.
  if (isHeic(file)) return;
  if (!file.type || !(ALLOWED_PHOTO_MIME as readonly string[]).includes(file.type)) {
    throw new PhotoPipelineError('فرمت عکس پشتیبانی نمی‌شود (JPG، PNG، WebP یا HEIC).');
  }
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  mime: 'image/webp' | 'image/jpeg',
  quality: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, mime, quality),
  );
  if (!blob) throw new PhotoPipelineError('تبدیل عکس در این مرورگر ممکن نیست.');
  return blob;
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Frees the bitmap or the object URL once the pixels are on the canvas. */
  release: () => void;
}

/**
 * Decode a picked still into something `drawImage` accepts.
 *
 * `createImageBitmap` is the fast path and applies EXIF orientation. When it
 * refuses the file, an `<img>` decode is tried once: Safari can paint HEIC/HEIF
 * there even though the bitmap API cannot read it, which is exactly the case
 * an iPhone photo hits.
 */
async function decodeImage(file: File): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('image decode failed'));
        element.src = url;
      });
      return {
        source: image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        release: () => URL.revokeObjectURL(url),
      };
    } catch {
      URL.revokeObjectURL(url);
      throw new PhotoPipelineError(
        isHeic(file)
          ? HEIC_CONVERT_FAILED
          : 'خواندن فایل عکس ممکن نیست؛ فایل دیگری انتخاب کنید.',
      );
    }
  }
}

export async function processListingPhoto(file: File): Promise<ProcessedPhoto> {
  ensureSupportedMime(file);
  if (file.size === 0) throw new PhotoPipelineError('فایل عکس خالی است.');

  // A HEIC is stored as JPEG: no browser but Safari paints HEIC, and the
  // server stores bytes exactly as received.
  const mime = isHeic(file) ? 'image/jpeg' : 'image/webp';

  const decoded = await decodeImage(file);
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PhotoPipelineError('پردازش تصویر در این مرورگر در دسترس نیست.');
    ctx.drawImage(decoded.source, 0, 0, width, height);

    let blob = await encodeCanvas(canvas, mime, IMAGE_QUALITY);
    if (blob.size > MAX_PHOTO_BYTES) {
      // One retry at lower quality before giving up (huge panoramas).
      blob = await encodeCanvas(canvas, mime, RETRY_QUALITY);
    }
    if (blob.size > MAX_PHOTO_BYTES) {
      throw new PhotoPipelineError('حجم عکس حتی پس از فشرده‌سازی بیش از حد مجاز است.');
    }

    return {
      kind: 'image',
      mime,
      blob,
      previewUrl: URL.createObjectURL(blob),
      width,
      height,
      bytes: blob.size,
      path: null,
      url: null,
    };
  } finally {
    decoded.release();
  }
}

const VIDEO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/**
 * A short clip, uploaded as-is (no canvas re-encode). The browser's own video
 * metadata supplies the pixel size, which the schema and the storage row keep.
 */
export async function processListingVideo(file: File): Promise<ProcessedPhoto> {
  if (!(ALLOWED_VIDEO_MIME as readonly string[]).includes(file.type)) {
    throw new PhotoPipelineError('فرمت ویدیو پشتیبانی نمی‌شود (MP4، WebM یا MOV).');
  }
  if (file.size === 0) throw new PhotoPipelineError('فایل ویدیو خالی است.');
  if (file.size > MAX_VIDEO_BYTES) {
    throw new PhotoPipelineError('حجم ویدیو بیش از ۴۰ مگابایت است؛ فایل کوتاه‌تری انتخاب کنید.');
  }

  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth || 1080, height: video.videoHeight || 1920 });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      resolve({ width: 1080, height: 1920 });
      URL.revokeObjectURL(url);
    };
    video.src = url;
  });

  return {
    kind: 'video',
    mime: file.type as ListingPhoto['mime'],
    blob: file,
    previewUrl: URL.createObjectURL(file),
    width: size.width,
    height: size.height,
    bytes: file.size,
    path: null,
    url: null,
  };
}

/** Route a picked file to the photo or video pipeline. */
export async function processListingMedia(file: File): Promise<ProcessedPhoto> {
  if ((ALLOWED_VIDEO_MIME as readonly string[]).includes(file.type)) {
    return processListingVideo(file);
  }
  return processListingPhoto(file);
}

export function videoExtension(mime: string): string {
  return VIDEO_EXT[mime] ?? 'mp4';
}

/**
 * Upload the compressed bytes and attach the durable path.
 *
 * The bytes leave the browser exactly once; everything after this point refers
 * to the returned storage path, so the publish payload never carries image
 * data.
 */
export async function uploadProcessedPhoto(photo: ProcessedPhoto): Promise<ProcessedPhoto> {
  if (!photo.blob) throw new PhotoPipelineError('فایل رسانه در دسترس نیست؛ دوباره انتخاب کنید.');
  const form = new FormData();
  const filename =
    photo.kind === 'video'
      ? `clip.${videoExtension(photo.mime)}`
      : photo.mime === 'image/jpeg'
        ? 'photo.jpg'
        : 'photo.webp';
  form.append('file', new File([photo.blob], filename, { type: photo.mime }), filename);
  form.append('mime', photo.mime);
  form.append('width', String(photo.width));
  form.append('height', String(photo.height));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch('/api/photos', { method: 'POST', body: form, signal: controller.signal });
  } catch (error) {
    throw new PhotoPipelineError(
      error instanceof DOMException && error.name === 'AbortError'
        ? 'بارگذاری عکس بیش از حد طول کشید؛ اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.'
        : 'ارتباط با سرور برای بارگذاری عکس برقرار نشد.',
    );
  } finally {
    clearTimeout(timer);
  }

  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    path?: string;
    url?: string;
    error?: string;
  } | null;

  if (!res.ok || !body?.path) {
    // Name the real reason (a 413 is a size problem, not a dropped connection).
    throw new PhotoPipelineError(
      body?.error ??
        (res.status === 413
          ? 'حجم عکس پس از فشرده‌سازی بیش از حد مجاز است (خطای 413).'
          : `بارگذاری عکس ناموفق بود (خطای ${res.status})؛ دوباره تلاش کنید.`),
    );
  }
  return { ...photo, path: body.path, url: body.url ?? null };
}
