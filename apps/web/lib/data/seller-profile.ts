import type { ListingCardData } from './listings';
import { accountPhone, getUser, listingsBySeller, type Account } from './s2-store';
import { averageRating, reviewsFor, type SellerReview } from './reviews';
import { fixtureListings } from './fixtures';
import { devListings } from './dev-store';
import { visibleCatalog } from './demo-seed';
import { followerCount, profileCustomization } from './social-store';
import { storiesFrom } from '../stories';
import type { StoryItem } from '@/components/Stories';
import type { ProfileMode } from '@alisales/schemas';
import { resolveSellerProfileMode } from '../seller-visibility';

/**
 * Public seller profile data.
 *
 * The brief trims the identity page to what a buyer actually uses: how many
 * listings are live, how the showroom is rated, what it has on its story rail
 * and who follows it. Sold counts, response rate and reply time are gone —
 * they answered a question nobody asked on a showroom page.
 */
export interface SellerStats {
  active: number;
  rating: number | null;
  reviewCount: number;
  followers: number;
  stories: number;
}

export interface SellerProfile {
  id: string;
  /** Personal profiles are private; only business profiles have public pages. */
  profileMode: ProfileMode;
  name: string;
  initials: string;
  verified: boolean;
  city: string;
  memberSince: string | null;
  hasPhone: boolean;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  listings: ListingCardData[];
  active: ListingCardData[];
  reviews: SellerReview[];
  stories: StoryItem[];
  stats: SellerStats;
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
    : visibleCatalog(fixtureListings, devListings()).filter((listing) => listing.sellerId === sellerId);
  if (!account && listings.length === 0) return null;

  const [reviews, phone, custom, followers] = await Promise.all([
    reviewsFor(sellerId),
    accountPhone(sellerId),
    profileCustomization(sellerId),
    followerCount(sellerId),
  ]);

  const active = listings.filter((listing) => listing.state === 'active');
  const profileMode = resolveSellerProfileMode(custom?.profileMode, account?.accountType, listings);
  const name =
    account?.displayName?.trim() || listings[0]?.showroomName?.trim() || 'فروشنده آلی‌سیلز';
  // The seller's own story rail: their live, photographed stock, newest first.
  const stories = storiesFrom(active, [], [], 8);
  const rating = averageRating(reviews);

  // The seller's market: the city most of their listings are in.
  const counts = new Map<string, number>();
  for (const listing of listings) counts.set(listing.city, (counts.get(listing.city) ?? 0) + 1);
  const city = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'kish';

  return {
    id: sellerId,
    profileMode,
    name,
    initials: name.trim().charAt(0) || '؟',
    verified:
      listings.some((listing) => listing.showroomVerified) || Boolean(listings[0]?.showroomName),
    city,
    memberSince: account?.createdAt ?? listings.at(-1)?.publishedAt ?? null,
    hasPhone: Boolean(phone),
    bio: custom?.bio?.trim() ? custom.bio.trim() : null,
    avatarUrl: custom?.avatarUrl ?? null,
    coverUrl: custom?.coverUrl ?? null,
    listings,
    active,
    reviews,
    stories,
    stats: {
      active: active.length,
      rating,
      reviewCount: reviews.length,
      followers,
      stories: stories.length,
    },
  };
}
