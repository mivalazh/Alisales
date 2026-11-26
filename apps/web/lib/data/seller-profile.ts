import type { ListingCardData } from './listings';
import { accountPhone, getUser, listingsBySeller, type Account } from './s2-store';
import { averageRating, reviewsFor, type SellerReview } from './reviews';
import { fixtureListings } from './fixtures';
import { devListings } from './dev-store';
import { visibleCatalog } from './demo-seed';
import { profileCustomization } from './social-store';
import { coverForSeller } from './profile-cover';
import { listStoriesByAuthor } from './platform-store';
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
/** Demo showrooms that exist only as seeded inventory (no account row). */
const DEMO_SELLERS: Readonly<Record<string, { name: string; verified: boolean }>> = {
  '00000000-0000-0000-0000-00000000000d': { name: 'گالری خودرو کیش', verified: true },
  '00000000-0000-0000-0000-00000000000c': { name: 'نمایشگاه آلی سیلز', verified: true },
};

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

  const [reviews, phone, custom, storyRows] = await Promise.all([
    reviewsFor(sellerId),
    accountPhone(sellerId),
    profileCustomization(sellerId),
    listStoriesByAuthor(sellerId, 'approved').catch(() => []),
  ]);

  const active = listings.filter((listing) => listing.state === 'active');
  const profileMode = resolveSellerProfileMode(custom?.profileMode, account?.accountType, listings);
  // Fixture sellers have no account row, so their identity comes from the
  // seed directory instead of a generic placeholder — that placeholder was why
  // demo showroom pages looked like unnamed, broken profiles.
  const demo = DEMO_SELLERS[sellerId];
  const name =
    account?.displayName?.trim() ||
    listings[0]?.showroomName?.trim() ||
    demo?.name ||
    'فروشنده آلی‌سیلز';
  // The seller's own rail: only stories they submitted, never their listings.
  const stories: StoryItem[] = storyRows.map((story) => ({
    id: story.id,
    slug: `story-${story.id}`,
    title: story.title,
    coverUrl: story.mediaUrl,
    href: story.listingSlug ? `/listing/${story.listingSlug}` : `/seller/${sellerId}`,
    authorId: story.authorId,
    listingSlug: story.listingSlug,
    ...(story.mediaKind === 'video' ? { videoUrl: story.mediaUrl } : {}),
  }));
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
    // A star is a team decision: only inventory explicitly marked verified (or
    // a demo showroom the team endorsed) earns it. Merely having a showroom
    // name no longer implies verification.
    verified: listings.some((listing) => listing.showroomVerified) || Boolean(demo?.verified),
    city,
    hasPhone: Boolean(phone),
    bio: custom?.bio?.trim() ? custom.bio.trim() : null,
    avatarUrl: custom?.avatarUrl ?? null,
    // A seller-chosen cover wins; otherwise a stable vehicle photo derived
    // from the id, never the flat orange banner.
    coverUrl: custom?.coverUrl ?? coverForSeller(sellerId),
    listings,
    active,
    reviews,
    stories,
    stats: {
      active: active.length,
      rating,
      reviewCount: reviews.length,
      stories: stories.length,
    },
  };
}
