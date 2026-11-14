import { randomUUID } from 'node:crypto';
import { admin } from './s2-store';
import { deleteBytes, readBytes, writeBytes } from '../storage/demo-store';
import {
  MAX_PROFILE_MEDIA_BYTES,
  PROFILE_EDGE_PX,
  PROFILE_MEDIA_BUCKET,
  STORY_MAX_EDGE_PX,
  STORY_MEDIA_BUCKET,
  STORY_VIDEO_MAX_EDGE_PX,
  devMediaUrl,
  isProfileMime,
  isSafeMediaPath,
  isStoryImageMime,
  isStoryVideoMime,
  mediaExtension,
  parseMediaUrl,
  publicMediaUrl,
  storyByteLimit,
  type ProfileMediaKind,
} from '../media-rules';

/**
 * Profile/story object storage.
 *
 * Uploads are server-side (the browser posts compressed bytes to `/api/media/*`
 * after the session is checked). Hosted mode writes to the public
 * `profile-media` / `story-media` buckets with the service role; fixture mode
 * keeps the same path shape in the demo store and serves it from
 * `/api/media/:bucket/*`.
 */

const DEV_PREFIX = 'media';

export interface StoredMedia {
  path: string;
  url: string;
}

export interface MediaBytes {
  userId: string;
  bytes: Uint8Array;
  mime: string;
  width: number;
  height: number;
}

function assertDimensions(width: number, height: number, maxEdge: number): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    Math.max(width, height) > maxEdge
  ) {
    throw new Error('invalid media dimensions');
  }
}

function assertSafePath(path: string): void {
  if (!isSafeMediaPath(path)) throw new Error('invalid media path');
}

async function storeInBucket(
  bucket: string,
  path: string,
  bytes: Uint8Array,
  mime: string,
): Promise<StoredMedia> {
  assertSafePath(path);
  const sb = admin();
  if (sb) {
    const uploaded = await sb.storage
      .from(bucket)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (uploaded.error) throw new Error(`media upload failed: ${uploaded.error.message}`);
    const url = sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    return { path, url };
  }
  writeBytes(`${DEV_PREFIX}/${bucket}/${path}`, bytes);
  return { path, url: devMediaUrl(bucket, path) };
}

export async function storeProfileMedia(
  input: MediaBytes & { kind: ProfileMediaKind },
): Promise<StoredMedia> {
  if (!isProfileMime(input.mime)) throw new Error('unsupported profile media type');
  if (input.bytes.byteLength === 0) throw new Error('empty profile media');
  if (input.bytes.byteLength > MAX_PROFILE_MEDIA_BYTES) throw new Error('profile media too large');
  assertDimensions(input.width, input.height, PROFILE_EDGE_PX[input.kind]);
  const path = `${input.userId}/${input.kind}-${randomUUID()}.${mediaExtension(input.mime)}`;
  return storeInBucket(PROFILE_MEDIA_BUCKET, path, input.bytes, input.mime);
}

export async function storeStoryMedia(input: MediaBytes): Promise<StoredMedia> {
  if (!isStoryImageMime(input.mime) && !isStoryVideoMime(input.mime)) {
    throw new Error('unsupported story media type');
  }
  if (input.bytes.byteLength === 0) throw new Error('empty story media');
  if (input.bytes.byteLength > storyByteLimit(input.mime)) throw new Error('story media too large');
  assertDimensions(
    input.width,
    input.height,
    isStoryVideoMime(input.mime) ? STORY_VIDEO_MAX_EDGE_PX : STORY_MAX_EDGE_PX,
  );
  const path = `${input.userId}/${randomUUID()}.${mediaExtension(input.mime)}`;
  return storeInBucket(STORY_MEDIA_BUCKET, path, input.bytes, input.mime);
}

/** Deletes a known object; fixture and hosted missing keys are harmless. */
export async function deleteStoredMedia(bucket: string, path: string): Promise<boolean> {
  if (bucket !== PROFILE_MEDIA_BUCKET && bucket !== STORY_MEDIA_BUCKET) return false;
  if (!isSafeMediaPath(path)) return false;
  const sb = admin();
  if (sb) {
    const { error } = await sb.storage.from(bucket).remove([path]);
    return !error;
  }
  deleteBytes(`${DEV_PREFIX}/${bucket}/${path}`);
  return true;
}

/**
 * Deletes an object only when the URL belongs to one of our media buckets.
 * Curated avatars, listing photos and arbitrary remote URLs are left alone.
 */
export async function deleteMediaUrl(url: string | null | undefined): Promise<boolean> {
  const parsed = parseMediaUrl(url);
  if (!parsed) return false;
  return deleteStoredMedia(parsed.bucket, parsed.path);
}

/** Fixture-mode serving: `/api/media/:bucket/:path`. */
export function readDevMedia(
  bucket: string,
  path: string,
): { bytes: ArrayBuffer; mime: string } | null {
  if (bucket !== PROFILE_MEDIA_BUCKET && bucket !== STORY_MEDIA_BUCKET) return null;
  if (!isSafeMediaPath(path)) return null;
  const bytes = readBytes(`${DEV_PREFIX}/${bucket}/${path}`);
  if (!bytes) return null;
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
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

/** Public URL for a path, using the same project URL as the Supabase client. */
export function hostedMediaUrl(bucket: string, path: string): string | null {
  return publicMediaUrl(bucket, path, process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL);
}
