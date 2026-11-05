import { readJson, writeJson } from '../storage/demo-store';

/**
 * Social layer: which showrooms a buyer follows, and how a seller dresses up
 * their own profile (avatar, cover, bio).
 *
 * Neither concept has a Supabase table yet, so both live in the demo store
 * alongside reviews: a JSON file per key in development and `next start`, and
 * isolate memory on the hosted preview. The shape is the one the real tables
 * would carry (`follows(user_id, seller_id)`, `profiles(avatar_url, cover_url,
 * bio)`), so moving to SQL later is a body swap.
 */
export interface FollowRow {
  userId: string;
  sellerId: string;
  createdAt: string;
}

export interface ProfileCustomization {
  /** «درباره من یا نمایشگاه» — free text, shown under the identity row. */
  bio: string;
  /** Absolute or data URL; null keeps the initials monogram. */
  avatarUrl: string | null;
  /** Absolute or data URL; null keeps the default gradient banner. */
  coverUrl: string | null;
  updatedAt: string;
}

interface SocialFile {
  follows: FollowRow[];
  profiles: Record<string, ProfileCustomization>;
}

const FILE = 'social.json';

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

/** Seller ids this buyer follows, newest first. */
export function followedSellerIds(userId: string | null | undefined): string[] {
  if (!userId) return [];
  return read()
    .follows.filter((row) => row.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((row) => row.sellerId);
}

export function isFollowing(userId: string | null | undefined, sellerId: string): boolean {
  if (!userId) return false;
  return read().follows.some((row) => row.userId === userId && row.sellerId === sellerId);
}

export function followerCount(sellerId: string): number {
  return read().follows.filter((row) => row.sellerId === sellerId).length;
}

/** Toggles a follow; returns the new state. A seller cannot follow themselves. */
export function toggleFollow(userId: string, sellerId: string): boolean {
  if (!userId || !sellerId || userId === sellerId) return false;
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

/** Stored customization for a seller, or null when they never saved one. */
export function profileCustomization(sellerId: string): ProfileCustomization | null {
  return read().profiles[sellerId] ?? null;
}

export const BIO_MAX = 400;
/** ~180 KB per image keeps both fields well inside the demo store file. */
export const IMAGE_MAX_CHARS = 240_000;

export function saveProfileCustomization(
  sellerId: string,
  next: { bio?: string; avatarUrl?: string | null; coverUrl?: string | null },
): ProfileCustomization {
  const data = read();
  const previous = data.profiles[sellerId];
  const saved: ProfileCustomization = {
    bio: (next.bio ?? previous?.bio ?? '').trim().slice(0, BIO_MAX),
    avatarUrl: next.avatarUrl === undefined ? (previous?.avatarUrl ?? null) : next.avatarUrl,
    coverUrl: next.coverUrl === undefined ? (previous?.coverUrl ?? null) : next.coverUrl,
    updatedAt: new Date().toISOString(),
  };
  data.profiles[sellerId] = saved;
  write(data);
  return saved;
}
