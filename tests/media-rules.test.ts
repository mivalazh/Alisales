import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  MAX_MEDIA_URL_CHARS,
  MAX_PROFILE_MEDIA_BYTES,
  MAX_STORY_IMAGE_BYTES,
  MAX_STORY_VIDEO_BYTES,
  PROFILE_MEDIA_BUCKET,
  STORY_MEDIA_BUCKET,
  isProfileMediaUrl,
  isSafeMediaPath,
  isStoryMediaUrl,
  ownsMediaUrl,
  parseMediaUrl,
  storyByteLimit,
} from '../apps/web/lib/media-rules';

const PROJECT = 'https://x.supabase.co';
const PROFILE = 'https://x.supabase.co/storage/v1/object/public/profile-media/u/avatar.webp';
const STORY = 'https://x.supabase.co/storage/v1/object/public/story-media/u/story.webp';

beforeAll(() => {
  vi.stubEnv('SUPABASE_URL', PROJECT);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', PROJECT);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('media rules', () => {
  it('parses only our own profile and story object URLs', () => {
    expect(parseMediaUrl(PROFILE, [PROJECT])).toEqual({
      bucket: PROFILE_MEDIA_BUCKET,
      path: 'u/avatar.webp',
    });
    expect(parseMediaUrl(STORY, [PROJECT])).toEqual({
      bucket: STORY_MEDIA_BUCKET,
      path: 'u/story.webp',
    });
    expect(parseMediaUrl('/api/media/story-media/u/story.webp')).toEqual({
      bucket: STORY_MEDIA_BUCKET,
      path: 'u/story.webp',
    });
    expect(parseMediaUrl('/api/media/listing-photos/u/a.webp')).toBeNull();
    expect(parseMediaUrl('https://x.supabase.co/storage/v1/object/public/listing-photos/u/a.webp', [
      PROJECT,
    ])).toBeNull();
    expect(parseMediaUrl('data:image/webp;base64,AAAA')).toBeNull();
    expect(parseMediaUrl('javascript:alert(1)')).toBeNull();
  });

  it('classifies profile and story URLs', () => {
    expect(isProfileMediaUrl(PROFILE)).toBe(true);
    expect(isStoryMediaUrl(PROFILE)).toBe(false);
    expect(isStoryMediaUrl(STORY)).toBe(true);
    expect(isProfileMediaUrl('/avatars/curated.svg')).toBe(false);
  });

  it('only treats the caller folder as owned media', () => {
    expect(ownsMediaUrl(PROFILE, 'u')).toBe(true);
    expect(ownsMediaUrl(STORY, 'u')).toBe(true);
    expect(ownsMediaUrl(PROFILE, 'someone-else')).toBe(false);
    expect(ownsMediaUrl('data:image/webp;base64,AAAA', 'u')).toBe(false);
  });

  it('refuses traversal and empty object paths', () => {
    expect(isSafeMediaPath('u/avatar.webp')).toBe(true);
    expect(isSafeMediaPath('../avatar.webp')).toBe(false);
    expect(isSafeMediaPath('u/../avatar.webp')).toBe(false);
    expect(isSafeMediaPath('/u/avatar.webp')).toBe(false);
    expect(isSafeMediaPath('')).toBe(false);
    expect(parseMediaUrl('/api/media/profile-media/u/../a.webp')).toBeNull();
  });

  it('keeps limits explicit', () => {
    expect(MAX_PROFILE_MEDIA_BYTES).toBe(2 * 1024 * 1024);
    expect(MAX_STORY_IMAGE_BYTES).toBe(8 * 1024 * 1024);
    expect(MAX_STORY_VIDEO_BYTES).toBe(40 * 1024 * 1024);
    expect(storyByteLimit('image/webp')).toBe(MAX_STORY_IMAGE_BYTES);
    expect(storyByteLimit('video/mp4')).toBe(MAX_STORY_VIDEO_BYTES);
    expect(MAX_MEDIA_URL_CHARS).toBeLessThan(4096);
  });
});
