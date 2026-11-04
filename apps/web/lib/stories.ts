import type { StoryItem } from '@/components/Stories';
import type { ListingCardData } from '@/lib/data/listings';

/**
 * Story rail assembly, shared by the home page and the two category pages.
 *
 * Order is meaningful: listings the owner approved in /admin come first, then
 * the editorial picks, then any photographed listing in the same pool. The
 * category pages pass their own editorial slugs, so /cars only ever shows
 * vehicles and /parts only ever shows spare parts.
 */
export function storyTitle(listing: ListingCardData): string {
  if (listing.part) return listing.part.title;
  return `${listing.model}${listing.trim ? ` ${listing.trim}` : ''}`;
}

export function storiesFrom(
  listings: readonly ListingCardData[],
  approved: readonly string[],
  editorial: readonly string[],
  limit = 6,
): StoryItem[] {
  const bySlug = (slug: string) => listings.find((l) => l.slug === slug);
  const pinned = approved.map(bySlug).filter((l): l is ListingCardData => Boolean(l?.coverUrl));
  const picked = editorial.map(bySlug).filter((l): l is ListingCardData => Boolean(l?.coverUrl));
  const fallback = listings.filter((l) => l.coverUrl);
  const seen = new Set<string>();
  const source = [...pinned, ...picked, ...fallback].filter((listing) => {
    if (seen.has(listing.slug)) return false;
    seen.add(listing.slug);
    return true;
  });
  return source.slice(0, limit).map((listing) => ({
    slug: listing.slug,
    title: storyTitle(listing),
    coverUrl: listing.coverUrl!,
    href: `/listing/${listing.slug}`,
  }));
}
