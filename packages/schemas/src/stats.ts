/**
 * Owner-only statistics (S2 / C2).
 *
 * Pure aggregation, shared by the web app and by tests. The rules encoded
 * here are the product rules:
 *  - «بازدید» counts one view per account per listing, no matter how often
 *    the listing is opened (duplicate rows are collapsed here as a second line
 *    of defence behind the DB unique key).
 *  - «گفتگوی جدید» and «نمایش شماره» are two separate counters and are never
 *    added together into a single "contact" number.
 *  - «علاقه‌مندی» is the current number of accounts that saved the listing;
 *    re-saving after removing counts once.
 *  - A listing with no events still appears with zeros when its id is passed
 *    in, so the owner panel never hides a listing.
 */

export interface OwnerStatsInput {
  /** Listing ids the owner asked about (their own listings only). */
  listingIds?: readonly string[];
  views?: ReadonlyArray<{ listingId: string; viewerId: string }>;
  reveals?: ReadonlyArray<{ listingId: string }>;
  conversations?: ReadonlyArray<{ listingId: string }>;
  favorites?: ReadonlyArray<{ listingId: string; userId: string }>;
}

export interface ListingOwnerStats {
  listingId: string;
  /** Unique accounts that opened the listing. */
  views: number;
  /** Conversations started from this listing («گفتگوی جدید»). */
  chatStarts: number;
  /** Times another account revealed the phone number («نمایش شماره»). */
  phoneReveals: number;
  /** Accounts that currently have the listing saved. */
  favorites: number;
}

interface Bucket {
  viewers: Set<string>;
  favoriters: Set<string>;
  chatStarts: number;
  phoneReveals: number;
}

function bucketFor(map: Map<string, Bucket>, listingId: string): Bucket {
  let bucket = map.get(listingId);
  if (!bucket) {
    bucket = { viewers: new Set(), favoriters: new Set(), chatStarts: 0, phoneReveals: 0 };
    map.set(listingId, bucket);
  }
  return bucket;
}

export function summarizeOwnerStats(input: OwnerStatsInput): ListingOwnerStats[] {
  const buckets = new Map<string, Bucket>();

  for (const id of input.listingIds ?? []) bucketFor(buckets, id);
  for (const view of input.views ?? []) {
    bucketFor(buckets, view.listingId).viewers.add(view.viewerId);
  }
  for (const reveal of input.reveals ?? []) {
    bucketFor(buckets, reveal.listingId).phoneReveals += 1;
  }
  for (const conversation of input.conversations ?? []) {
    bucketFor(buckets, conversation.listingId).chatStarts += 1;
  }
  for (const favorite of input.favorites ?? []) {
    bucketFor(buckets, favorite.listingId).favoriters.add(favorite.userId);
  }

  const order = input.listingIds ? [...input.listingIds] : [...buckets.keys()].sort();
  const rows: ListingOwnerStats[] = [];
  for (const listingId of order) {
    const bucket = buckets.get(listingId);
    rows.push({
      listingId,
      views: bucket ? bucket.viewers.size : 0,
      chatStarts: bucket ? bucket.chatStarts : 0,
      phoneReveals: bucket ? bucket.phoneReveals : 0,
      favorites: bucket ? bucket.favoriters.size : 0,
    });
  }
  return rows;
}

/** Panel-level totals. Contacts stay split, exactly like the per-listing rows. */
export function totalOwnerStats(rows: readonly ListingOwnerStats[]): {
  views: number;
  chatStarts: number;
  phoneReveals: number;
  favorites: number;
} {
  let views = 0;
  let chatStarts = 0;
  let phoneReveals = 0;
  let favorites = 0;
  for (const row of rows) {
    views += row.views;
    chatStarts += row.chatStarts;
    phoneReveals += row.phoneReveals;
    favorites += row.favorites;
  }
  return { views, chatStarts, phoneReveals, favorites };
}
