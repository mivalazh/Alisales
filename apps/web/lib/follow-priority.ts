import type { ListingCardData } from './data/listings';

/**
 * Followed showrooms first, everything else in the order it already had.
 *
 * The browse feeds sort by freshness, price or mileage; a buyer who follows a
 * showroom wants that showroom's new stock on top of the default feed without
 * losing the chosen sort inside each group. A stable partition does exactly
 * that — no re-sorting, no duplicates, no change when nothing is followed.
 */
export function boostFollowed<T extends { sellerId: string }>(
  listings: readonly T[],
  followedSellerIds: readonly string[],
): T[] {
  if (followedSellerIds.length === 0) return [...listings];
  const followed = new Set(followedSellerIds);
  const first: T[] = [];
  const rest: T[] = [];
  for (const listing of listings) {
    (followed.has(listing.sellerId) ? first : rest).push(listing);
  }
  return [...first, ...rest];
}

/** Count of listings in a feed that belong to a followed showroom. */
export function followedListingCount(
  listings: readonly Pick<ListingCardData, 'sellerId'>[],
  followedSellerIds: readonly string[],
): number {
  if (followedSellerIds.length === 0) return 0;
  const followed = new Set(followedSellerIds);
  return listings.filter((listing) => followed.has(listing.sellerId)).length;
}
