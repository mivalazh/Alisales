import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../apps/web/lib/data/s2-store', async () => {
  const { fakeAdmin } = await import('./helpers/fake-supabase');
  return { admin: fakeAdmin };
});

import {
  followerCount,
  followedSellerIds,
  isFollowing,
  profileCustomization,
  saveProfileCustomization,
  toggleFollow,
} from '../apps/web/lib/data/social-store';
import { resetSocialDb, socialTables } from './helpers/fake-supabase';

const ALICE = '00000000-0000-0000-0000-00000000000c';
const BOB = '00000000-0000-0000-0000-00000000000d';

beforeEach(() => {
  resetSocialDb();
});

describe('social store hosted path', () => {
  it('returns null until a profile row exists', async () => {
    await expect(profileCustomization(ALICE)).resolves.toBeNull();
    expect(socialTables.profile_customizations).toHaveLength(0);
  });

  it('writes and reads every profile field through profile_customizations', async () => {
    const saved = await saveProfileCustomization(ALICE, {
      bio: '  نمایشگاه خودروهای وارداتی  ',
      avatarUrl: 'https://cdn.example/avatar.webp',
      coverUrl: 'https://cdn.example/cover.webp',
      profileMode: 'business',
      businessType: 'car-dealer',
    });

    expect(saved).toMatchObject({
      bio: 'نمایشگاه خودروهای وارداتی',
      avatarUrl: 'https://cdn.example/avatar.webp',
      coverUrl: 'https://cdn.example/cover.webp',
      profileMode: 'business',
      businessType: 'car-dealer',
    });
    expect(socialTables.profile_customizations).toEqual([
      expect.objectContaining({
        user_id: ALICE,
        bio: 'نمایشگاه خودروهای وارداتی',
        avatar_url: 'https://cdn.example/avatar.webp',
        cover_url: 'https://cdn.example/cover.webp',
        profile_mode: 'business',
        business_type: 'car-dealer',
      }),
    ]);

    await expect(profileCustomization(ALICE)).resolves.toMatchObject({
      bio: 'نمایشگاه خودروهای وارداتی',
      profileMode: 'business',
      businessType: 'car-dealer',
    });
  });

  it('keeps omitted fields when a later save changes only the bio', async () => {
    await saveProfileCustomization(ALICE, {
      bio: 'اولین متن',
      avatarUrl: 'https://cdn.example/avatar.webp',
      profileMode: 'personal',
      businessType: null,
    });

    const updated = await saveProfileCustomization(ALICE, { bio: 'متن تازه' });
    expect(updated).toMatchObject({
      bio: 'متن تازه',
      avatarUrl: 'https://cdn.example/avatar.webp',
      profileMode: 'personal',
      businessType: null,
    });
    expect(socialTables.profile_customizations).toHaveLength(1);
  });

  it('follows, counts and unfollows through seller_follows', async () => {
    expect(await followedSellerIds(ALICE)).toEqual([]);
    expect(await isFollowing(ALICE, BOB)).toBe(false);
    expect(await followerCount(BOB)).toBe(0);

    await expect(toggleFollow(ALICE, BOB)).resolves.toBe(true);
    expect(await followedSellerIds(ALICE)).toEqual([BOB]);
    expect(await isFollowing(ALICE, BOB)).toBe(true);
    expect(await followerCount(BOB)).toBe(1);
    expect(socialTables.seller_follows[0]).toMatchObject({
      follower_id: ALICE,
      seller_id: BOB,
    });

    await expect(toggleFollow(ALICE, BOB)).resolves.toBe(false);
    expect(await followedSellerIds(ALICE)).toEqual([]);
    expect(await isFollowing(ALICE, BOB)).toBe(false);
    expect(socialTables.seller_follows).toHaveLength(0);
  });

  it('never writes a self-follow or a follow without an account', async () => {
    await expect(toggleFollow(ALICE, ALICE)).resolves.toBe(false);
    await expect(toggleFollow('', BOB)).resolves.toBe(false);
    expect(await followedSellerIds(null)).toEqual([]);
    expect(await isFollowing(undefined, BOB)).toBe(false);
    expect(socialTables.seller_follows).toHaveLength(0);
  });
});
