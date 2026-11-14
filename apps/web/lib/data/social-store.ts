import type { BusinessType, ProfileMode } from '@alisales/schemas';
import { readJson, writeJson } from '../storage/demo-store';
import { admin } from './s2-store';

/**
 * Social layer: which sellers a buyer follows, and how a seller dresses up
 * their own profile (avatar, cover, bio, profile mode and business type).
 *
 * Two implementations behind one API:
 *  - Fixture mode (no Supabase credentials): the demo store, so the whole flow
 *    is reviewable offline and on a credential-less preview.
 *  - Hosted mode: `profile_customizations` + `seller_follows` in Supabase, so
 *    the data survives redeploys and is shared across Worker isolates.
 *
 * These functions are async in both modes. Server code always scopes writes by
 * the session user id — never by a value sent from the browser.
 */
export interface FollowRow {
  userId: string;
  sellerId: string;
  createdAt: string;
}

export interface ProfileCustomization {
  /** «درباره من یا نمایشگاه» — free text, shown under the identity row. */
  bio: string;
  /** Durable profile-media URL or a curated avatar; null uses the monogram. */
  avatarUrl: string | null;
  /** Durable profile-media URL; null keeps the default gradient banner. */
  coverUrl: string | null;
  /** Personal profiles stay private; business profiles are public storefronts. */
  profileMode?: ProfileMode | null;
  /** Business sub-type (car dealer, parts store, workshop, rental). */
  businessType?: BusinessType | null;
  updatedAt: string;
}

interface SocialFile {
  follows: FollowRow[];
  profiles: Record<string, ProfileCustomization>;
}

const FILE = 'social.json';

interface ProfileRow {
  user_id: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  profile_mode: ProfileMode | null;
  business_type: BusinessType | null;
  updated_at: string;
}

function read(): SocialFile {
  const data = readJson<SocialFile>(FILE, () => ({ follows: [], profiles: {} }));
  return {
    follows: Array.isArray(data.follows) ? data.follows : [],
    profiles: data.profiles && typeof data.profiles === 'object' ? data.profiles : {},
  };
}

function write(data: SocialFile): void {
  writeJson(FILE, data);
}

function mapProfile(row: ProfileRow): ProfileCustomization {
  return {
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? null,
    coverUrl: row.cover_url ?? null,
    profileMode: row.profile_mode ?? null,
    businessType: row.business_type ?? null,
    updatedAt: row.updated_at,
  };
}

/** Seller ids this buyer follows, newest first. */
export async function followedSellerIds(
  userId: string | null | undefined,
): Promise<string[]> {
  if (!userId) return [];
  const sb = admin();
  if (!sb) {
    return read()
      .follows.filter((row) => row.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((row) => row.sellerId);
  }
  const { data } = await sb
    .from('seller_follows')
    .select('seller_id')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });
  return ((data ?? []) as Array<{ seller_id: string }>).map((row) => row.seller_id);
}

export async function isFollowing(
  userId: string | null | undefined,
  sellerId: string,
): Promise<boolean> {
  if (!userId) return false;
  const sb = admin();
  if (!sb) {
    return read().follows.some(
      (row) => row.userId === userId && row.sellerId === sellerId,
    );
  }
  const { data } = await sb
    .from('seller_follows')
    .select('id')
    .eq('follower_id', userId)
    .eq('seller_id', sellerId)
    .maybeSingle();
  return Boolean(data);
}

export async function followerCount(sellerId: string): Promise<number> {
  const sb = admin();
  if (!sb) {
    return read().follows.filter((row) => row.sellerId === sellerId).length;
  }
  const { count } = await sb
    .from('seller_follows')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', sellerId);
  return count ?? 0;
}

/** Toggles a follow; returns the new state. A seller cannot follow themselves. */
export async function toggleFollow(userId: string, sellerId: string): Promise<boolean> {
  if (!userId || !sellerId || userId === sellerId) return false;
  const sb = admin();
  if (!sb) {
    const data = read();
    const index = data.follows.findIndex(
      (row) => row.userId === userId && row.sellerId === sellerId,
    );
    if (index >= 0) {
      data.follows.splice(index, 1);
      write(data);
      return false;
    }
    data.follows.push({ userId, sellerId, createdAt: new Date().toISOString() });
    write(data);
    return true;
  }

  const { data: existing } = await sb
    .from('seller_follows')
    .select('id')
    .eq('follower_id', userId)
    .eq('seller_id', sellerId)
    .maybeSingle();
  if (existing) {
    const { error } = await sb.from('seller_follows').delete().eq('id', existing.id);
    if (error) throw new Error(`unfollow failed: ${error.message}`);
    return false;
  }

  const { error } = await sb
    .from('seller_follows')
    .insert({ follower_id: userId, seller_id: sellerId });
  if (error) {
    // A concurrent toggle already inserted the pair; report the followed state.
    if (error.code === '23505') return true;
    throw new Error(`follow failed: ${error.message}`);
  }
  return true;
}

/** Stored customization for a seller, or null when they never saved one. */
export async function profileCustomization(
  sellerId: string,
): Promise<ProfileCustomization | null> {
  const sb = admin();
  if (!sb) return read().profiles[sellerId] ?? null;
  const { data } = await sb
    .from('profile_customizations')
    .select('user_id, bio, avatar_url, cover_url, profile_mode, business_type, updated_at')
    .eq('user_id', sellerId)
    .maybeSingle();
  return data ? mapProfile(data as ProfileRow) : null;
}

export const BIO_MAX = 400;

export async function saveProfileCustomization(
  sellerId: string,
  next: {
    bio?: string;
    avatarUrl?: string | null;
    coverUrl?: string | null;
    profileMode?: ProfileMode | null;
    businessType?: BusinessType | null;
  },
): Promise<ProfileCustomization> {
  const sb = admin();
  const previous = sb
    ? await profileCustomization(sellerId)
    : (read().profiles[sellerId] ?? null);
  const saved: ProfileCustomization = {
    bio: (next.bio ?? previous?.bio ?? '').trim().slice(0, BIO_MAX),
    avatarUrl: next.avatarUrl === undefined ? (previous?.avatarUrl ?? null) : next.avatarUrl,
    coverUrl: next.coverUrl === undefined ? (previous?.coverUrl ?? null) : next.coverUrl,
    profileMode: next.profileMode === undefined ? (previous?.profileMode ?? null) : next.profileMode,
    businessType:
      next.businessType === undefined ? (previous?.businessType ?? null) : next.businessType,
    updatedAt: new Date().toISOString(),
  };

  if (!sb) {
    const data = read();
    data.profiles[sellerId] = saved;
    write(data);
    return saved;
  }

  const { data, error } = await sb
    .from('profile_customizations')
    .upsert(
      {
        user_id: sellerId,
        bio: saved.bio,
        avatar_url: saved.avatarUrl,
        cover_url: saved.coverUrl,
        profile_mode: saved.profileMode,
        business_type: saved.businessType,
        updated_at: saved.updatedAt,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id, bio, avatar_url, cover_url, profile_mode, business_type, updated_at')
    .single();
  if (error || !data) {
    throw new Error(`save profile failed: ${error?.message ?? 'no row returned'}`);
  }
  return mapProfile(data as ProfileRow);
}
