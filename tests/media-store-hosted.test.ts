import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../apps/web/lib/data/s2-store', async () => {
  const { fakeAdmin } = await import('./helpers/fake-supabase');
  return { admin: fakeAdmin };
});

import {
  deleteMediaUrl,
  storeProfileMedia,
  storeStoryMedia,
} from '../apps/web/lib/data/media-store';
import {
  MAX_PROFILE_MEDIA_BYTES,
  MAX_STORY_IMAGE_BYTES,
} from '../apps/web/lib/media-rules';
import { resetSocialDb, socialStorage } from './helpers/fake-supabase';

const USER = '00000000-0000-0000-0000-00000000000c';

beforeAll(() => {
  vi.stubEnv('SUPABASE_URL', 'https://fake.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fake.supabase.co');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  resetSocialDb();
});

describe('hosted profile/story media storage', () => {
  it('uploads an avatar to profile-media and returns a public URL', async () => {
    const stored = await storeProfileMedia({
      userId: USER,
      kind: 'avatar',
      bytes: new Uint8Array([1, 2, 3]),
      mime: 'image/webp',
      width: 320,
      height: 320,
    });

    expect(stored.path).toMatch(new RegExp(`^${USER}/avatar-[0-9a-f-]+\\.webp$`));
    expect(stored.url).toBe(
      `https://fake.supabase.co/storage/v1/object/public/profile-media/${stored.path}`,
    );
    expect(socialStorage['profile-media']?.get(stored.path)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects oversized, unsupported and dimension-less profile media', async () => {
    await expect(
      storeProfileMedia({
        userId: USER,
        kind: 'cover',
        bytes: new Uint8Array(MAX_PROFILE_MEDIA_BYTES + 1),
        mime: 'image/webp',
        width: 1280,
        height: 720,
      }),
    ).rejects.toThrow('too large');

    await expect(
      storeProfileMedia({
        userId: USER,
        kind: 'cover',
        bytes: new Uint8Array([1]),
        mime: 'image/gif',
        width: 1280,
        height: 720,
      }),
    ).rejects.toThrow('unsupported');

    await expect(
      storeProfileMedia({
        userId: USER,
        kind: 'cover',
        bytes: new Uint8Array([1]),
        mime: 'image/webp',
        width: 0,
        height: 720,
      }),
    ).rejects.toThrow('dimensions');
  });

  it('uploads story images and clips to story-media', async () => {
    const image = await storeStoryMedia({
      userId: USER,
      bytes: new Uint8Array([4, 5]),
      mime: 'image/webp',
      width: 900,
      height: 1600,
    });
    expect(image.path).toMatch(new RegExp(`^${USER}/[0-9a-f-]+\\.webp$`));
    expect(socialStorage['story-media']?.has(image.path)).toBe(true);

    const video = await storeStoryMedia({
      userId: USER,
      bytes: new Uint8Array([6, 7]),
      mime: 'video/mp4',
      width: 1080,
      height: 1920,
    });
    expect(video.path.endsWith('.mp4')).toBe(true);
  });

  it('rejects an oversized story image or dimension', async () => {
    await expect(
      storeStoryMedia({
        userId: USER,
        bytes: new Uint8Array(MAX_STORY_IMAGE_BYTES + 1),
        mime: 'image/webp',
        width: 900,
        height: 1600,
      }),
    ).rejects.toThrow('too large');

    await expect(
      storeStoryMedia({
        userId: USER,
        bytes: new Uint8Array([1]),
        mime: 'image/webp',
        width: 1000,
        height: 1601,
      }),
    ).rejects.toThrow('dimensions');
  });

  it('cleans up only objects that belong to our media buckets', async () => {
    const stored = await storeProfileMedia({
      userId: USER,
      kind: 'cover',
      bytes: new Uint8Array([8]),
      mime: 'image/webp',
      width: 1280,
      height: 720,
    });
    expect(socialStorage['profile-media']?.has(stored.path)).toBe(true);

    await expect(deleteMediaUrl(stored.url)).resolves.toBe(true);
    expect(socialStorage['profile-media']?.has(stored.path)).toBe(false);

    await expect(
      deleteMediaUrl(
        'https://fake.supabase.co/storage/v1/object/public/listing-photos/x/a.webp',
      ),
    ).resolves.toBe(false);
    await expect(deleteMediaUrl('data:image/svg+xml,<svg></svg>')).resolves.toBe(false);
  });
});
