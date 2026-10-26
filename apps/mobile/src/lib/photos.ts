import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { launchImageLibraryAsync, type ImagePickerAsset } from 'expo-image-picker';
import { File } from 'expo-file-system';
import { ALLOWED_PHOTO_MIME, MAX_PHOTO_BYTES, MAX_PHOTOS } from '@alisales/schemas';

/**
 * Mobile listing photo pipeline (mirrors apps/web/lib/photos.ts):
 *
 *   pick (multi, ≤ remaining) → downscale (max edge 1600) → re-encode WebP
 *     → EXIF dropped by construction (fresh encode carries no metadata)
 *     → enforce ≤ 8 MB (one quality retry) → preview/upload-ready local file
 */

export const MAX_EDGE_PX = 1600;
const QUALITY = 0.85;
const RETRY_QUALITY = 0.6;

export interface ProcessedPhoto {
  /** Local cache URI — persist/upload before the OS evicts the cache. */
  uri: string;
  width: number;
  height: number;
  bytes: number;
}

export class PhotoPipelineError extends Error {}

async function measureBytes(uri: string): Promise<number> {
  try {
    const buffer = await new File(uri).arrayBuffer();
    if (buffer.byteLength > 0) return buffer.byteLength;
  } catch {
    // fall through to picker-reported size
  }
  return 0;
}

function resizeTarget(asset: ImagePickerAsset): { width?: number; height?: number } {
  // Constrain the LONG edge to 1600 (width for landscape, height for portrait).
  return asset.width >= asset.height
    ? { width: MAX_EDGE_PX }
    : { height: MAX_EDGE_PX };
}

async function saveWebp(uri: string, asset: ImagePickerAsset, quality: number) {
  const context = ImageManipulator.manipulate(uri, {
    // Decode-time downsampling: caps peak memory for 50 MP camera photos.
    maxWidth: MAX_EDGE_PX,
    maxHeight: MAX_EDGE_PX,
  });
  context.resize(resizeTarget(asset));
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ format: SaveFormat.WEBP, compress: quality });
}

export async function processListingPhoto(asset: ImagePickerAsset): Promise<ProcessedPhoto> {
  if (asset.type && asset.type !== 'image') {
    throw new PhotoPipelineError('فقط تصویر مجاز است.');
  }

  let result = await saveWebp(asset.uri, asset, QUALITY);
  let bytes = await measureBytes(result.uri);

  if (bytes > MAX_PHOTO_BYTES) {
    // One retry at lower quality before giving up (huge panoramas).
    result = await saveWebp(asset.uri, asset, RETRY_QUALITY);
    bytes = await measureBytes(result.uri);
  }
  if (bytes === 0) bytes = asset.fileSize ?? 0;
  if (bytes === 0) {
    throw new PhotoPipelineError('اندازه‌گیری فایل عکس ممکن نشد؛ دوباره تلاش کنید.');
  }
  if (bytes > MAX_PHOTO_BYTES) {
    throw new PhotoPipelineError('حجم عکس حتی پس از فشرده‌سازی بیش از حد مجاز است.');
  }

  return { uri: result.uri, width: result.width, height: result.height, bytes };
}

/** Opens the multi-select picker (≤ `remaining` images) and runs the pipeline. */
export async function pickAndProcessPhotos(remaining: number): Promise<ProcessedPhoto[]> {
  if (remaining <= 0) return [];

  const selection = await launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: Math.min(remaining, MAX_PHOTOS),
    quality: 1,
    exif: false,
  });
  if (selection.canceled || !selection.assets?.length) return [];

  const out: ProcessedPhoto[] = [];
  for (const asset of selection.assets) {
    try {
      out.push(await processListingPhoto(asset));
    } catch (e) {
      if (!(e instanceof PhotoPipelineError)) throw e;
      // Surface the first per-file failure to the caller via rejection? No —
      // keep partial success; caller shows what made it through.
      console.warn('[photos]', e.message);
    }
  }
  if (out.length === 0) throw new PhotoPipelineError('هیچ عکسی پردازش نشد.');
  return out;
}
