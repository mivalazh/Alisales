import { ALLOWED_PHOTO_MIME, ALLOWED_VIDEO_MIME } from '@alisales/schemas';

/**
 * Profile/story media rules shared by the browser, upload routes and tests.
 *
 * Images are compressed client-side before upload (avatars 320px, covers
 * 1280px, stories 1600px). The server still enforces type/size/dimension limits
 * and re-checks that a submitted story URL belongs to its own bucket.
 */

export const PROFILE_MEDIA_BUCKET = 'profile-media';
export const STORY_MEDIA_BUCKET = 'story-media';

export type ProfileMediaKind = 'avatar' | 'cover';

export const MAX_PROFILE_MEDIA_BYTES = 2 * 1024 * 1024;
export const MAX_STORY_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_STORY_VIDEO_BYTES = 40 * 1024 * 1024;
export const MAX_MEDIA_URL_CHARS = 2048;

export const AVATAR_EDGE_PX = 320;
export const COVER_EDGE_PX = 1280;
export const PROFILE_EDGE_PX: Record<ProfileMediaKind, number> = {
  avatar: AVATAR_EDGE_PX,
  cover: COVER_EDGE_PX,
};

export const STORY_MAX_EDGE_PX = 1600;
/** Clips are not re-encoded client-side, so allow ordinary full-HD/4K frames. */
export const STORY_VIDEO_MAX_EDGE_PX = 4096;

const PROFILE_MIME = new Set<string>(ALLOWED_PHOTO_MIME);
const STORY_IMAGE_MIME = new Set<string>(ALLOWED_PHOTO_MIME);
const STORY_VIDEO_MIME = new Set<string>(ALLOWED_VIDEO_MIME);

export function isProfileMime(mime: string): boolean {
  return PROFILE_MIME.has(mime);
}

export function isStoryImageMime(mime: string): boolean {
  return STORY_IMAGE_MIME.has(mime);
}

export function isStoryVideoMime(mime: string): boolean {
  return STORY_VIDEO_MIME.has(mime);
}

export function storyByteLimit(mime: string): number {
  return isStoryVideoMime(mime) ? MAX_STORY_VIDEO_BYTES : MAX_STORY_IMAGE_BYTES;
}

export function isSafeMediaPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  return (
    normalized.length > 0 &&
    !normalized.startsWith('/') &&
    !normalized.split('/').some((part) => part === '' || part === '.' || part === '..')
  );
}

export function mediaExtension(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    default:
      return 'webp';
  }
}

export function publicMediaUrl(
  bucket: string,
  path: string,
  projectUrl: string | undefined,
): string | null {
  if (!path || !projectUrl) return null;
  return `${projectUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${path}`;
}

export function devMediaUrl(bucket: string, path: string): string {
  return `/api/media/${bucket}/${path}`;
}

/**
 * Extracts `{ bucket, path }` from a URL only when it is one of our media
 * buckets. Curated avatars, listing photos and arbitrary remote URLs return
 * null, so cleanup can never delete an unrelated object.
 */
export function parseMediaUrl(
  url: string | null | undefined,
  projectUrls: readonly (string | undefined)[] = [
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ],
): { bucket: string; path: string } | null {
  if (!url) return null;
  const prefix = '/api/media/';
  if (url.startsWith(prefix)) {
    const rest = url.slice(prefix.length).split('?')[0] ?? '';
    const [bucket, ...segments] = rest.split('/');
    if (
      (bucket !== PROFILE_MEDIA_BUCKET && bucket !== STORY_MEDIA_BUCKET) ||
      segments.length === 0
    ) {
      return null;
    }
    const path = segments.join('/');
    return isSafeMediaPath(path) ? { bucket, path } : null;
  }

  for (const projectUrl of projectUrls) {
    if (!projectUrl) continue;
    const base = `${projectUrl.replace(/\/$/, '')}/storage/v1/object/public/`;
    if (!url.startsWith(base)) continue;
    const rest = url.slice(base.length).split('?')[0] ?? '';
    const [bucket, ...segments] = rest.split('/');
    if (
      (bucket !== PROFILE_MEDIA_BUCKET && bucket !== STORY_MEDIA_BUCKET) ||
      segments.length === 0
    ) {
      return null;
    }
    const path = segments.join('/');
    return isSafeMediaPath(path) ? { bucket, path } : null;
  }
  return null;
}

export function isProfileMediaUrl(url: string | null | undefined): boolean {
  return parseMediaUrl(url)?.bucket === PROFILE_MEDIA_BUCKET;
}

export function isStoryMediaUrl(url: string | null | undefined): boolean {
  return parseMediaUrl(url)?.bucket === STORY_MEDIA_BUCKET;
}

/** True only for an object path inside the account's own folder. */
export function ownsMediaUrl(url: string | null | undefined, userId: string): boolean {
  const parsed = parseMediaUrl(url);
  return Boolean(parsed && userId && parsed.path.startsWith(`${userId}/`));
}
