import type { ListingCardData } from './listings';
import {
  accountPhone,
  conversationsForUser,
  getUser,
  listingsBySeller,
  messagesForConversation,
  type Account,
} from './s2-store';
import { averageRating, reviewsFor, type SellerReview } from './reviews';
import { fixtureListings } from './fixtures';
import { devListings } from './dev-store';

/**
 * Public seller profile data.
 *
 * Everything here is derived from rows the app already has — listings, accounts
 * and conversations — so the profile never invents a statistic:
 *
 *  - active / sold counts come from the seller's own listing rows,
 *  - response rate = conversations where the seller replied at least once,
 *  - average reply time = mean gap between a buyer message and the seller's
 *    next message in the same conversation,
 *  - rating = the mean of the stored reviews (null when there are none).
 */
export interface SellerStats {
  active: number;
  sold: number;
  responseRate: number | null;
  /** Minutes; null when the seller has not replied yet. */
  averageReplyMinutes: number | null;
  rating: number | null;
  reviewCount: number;
}

export interface SellerProfile {
  id: string;
  name: string;
  initials: string;
  verified: boolean;
  city: string;
  memberSince: string | null;
  hasPhone: boolean;
  listings: ListingCardData[];
  active: ListingCardData[];
  sold: ListingCardData[];
  reviews: SellerReview[];
  stats: SellerStats;
}

/** Reply statistics from the seller's side of every conversation. */
async function responseStats(sellerId: string): Promise<{
  responseRate: number | null;
  averageReplyMinutes: number | null;
}> {
  const conversations = (await conversationsForUser(sellerId)).filter(
    (conversation) => conversation.sellerId === sellerId,
  );
  if (conversations.length === 0) return { responseRate: null, averageReplyMinutes: null };

  let replied = 0;
  const gaps: number[] = [];

  for (const conversation of conversations) {
    const messages = (await messagesForConversation(conversation.id)).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    let waitingSince: number | null = null;
    let didReply = false;

    for (const message of messages) {
      const at = Date.parse(message.createdAt);
      if (message.senderId !== sellerId) {
        // The buyer's newest unanswered message starts the clock.
        if (waitingSince === null) waitingSince = at;
        continue;
      }
      if (waitingSince !== null) {
        gaps.push(Math.max(0, (at - waitingSince) / 60_000));
        waitingSince = null;
      }
      didReply = true;
    }
    if (didReply) replied += 1;
  }

  const average = gaps.length
    ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length)
    : null;

  return {
    responseRate: Math.round((replied / conversations.length) * 100),
    averageReplyMinutes: average,
  };
}

/** The profile of one seller, or null when the account does not exist. */
export async function loadSellerProfile(sellerId: string): Promise<SellerProfile | null> {
  const account: Account | null = await getUser(sellerId);
  // Demo sellers exist only as fixture rows (they have no account record), so
  // their public profile resolves from the seeded inventory. Hosted sellers
  // always come from `listing_cards` first.
  const own = await listingsBySeller(sellerId);
  const listings = own.length
    ? own
    : [...devListings(), ...fixtureListings].filter((listing) => listing.sellerId === sellerId);
  if (!account && listings.length === 0) return null;

  const [reviews, response, phone] = await Promise.all([
    reviewsFor(sellerId),
    responseStats(sellerId),
    accountPhone(sellerId),
  ]);

  const active = listings.filter((listing) => listing.state === 'active');
  const sold = listings.filter((listing) => listing.state === 'sold');
  const name =
    account?.displayName?.trim() || listings[0]?.showroomName?.trim() || 'فروشنده آلی‌سیلز';

  // The seller's market: the city most of their listings are in.
  const counts = new Map<string, number>();
  for (const listing of listings) counts.set(listing.city, (counts.get(listing.city) ?? 0) + 1);
  const city = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'kish';

  return {
    id: sellerId,
    name,
    initials: name.trim().charAt(0) || '؟',
    verified:
      listings.some((listing) => listing.showroomVerified) || Boolean(listings[0]?.showroomName),
    city,
    memberSince: account?.createdAt ?? listings.at(-1)?.publishedAt ?? null,
    hasPhone: Boolean(phone),
    listings,
    active,
    sold,
    reviews,
    stats: {
      active: active.length,
      sold: sold.length,
      responseRate: response.responseRate,
      averageReplyMinutes: response.averageReplyMinutes,
      rating: averageRating(reviews),
      reviewCount: reviews.length,
    },
  };
}
