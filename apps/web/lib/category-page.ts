import {
  DEFAULT_FILTERS,
  parseFiltersFromSearchParams,
  type SearchFilters,
  type VehicleCategory,
} from '@alisales/schemas';
import { getSession } from './auth/session';
import { followedSellerIds } from './data/social-store';
import { boostFollowed } from './follow-priority';
import { searchListings, type ListingCardData } from './data/listings';
import { approvedStories } from './data/moderation';
import { storiesFrom } from './stories';
import { parseSortKey, type SortKey } from './sort';

/**
 * One search for the three vehicle-category pages.
 *
 * Each page is a thin server component over this helper: the same filter
 * parsing, the same two reads (filtered grid + unfiltered pool for live
 * counts), the same category narrowing and the same story assembly. The page
 * only supplies its copy, its editorial story slugs and its category.
 */
export interface CategoryPageData {
  filters: SearchFilters;
  sort: SortKey;
  listings: ListingCardData[];
  pool: ListingCardData[];
  stories: { slug: string; title: string; coverUrl: string; href: string; brand?: string }[];
}

const STORIES: Record<VehicleCategory, readonly string[]> = {
  car: ['land-cruiser-kish', 'patrol-platinum-kish', 's-class-kish', 'cayenne-kish', 'huracan-showroom'],
  motorcycle: ['yamaha-mt09-kish', 'honda-cbr500r-kish', 'kawasaki-ninja400-tehran', 'harley-sportster-s-kish'],
  heavy: ['volvo-fh16-kish', 'scania-r500-kish', 'caterpillar-320d-kish', 'howo-a7-dump-kish'],
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function loadCategoryPage(
  params: SearchParams,
  category: VehicleCategory,
): Promise<CategoryPageData> {
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const v = first(value);
    if (v !== undefined) raw[key] = v;
  }

  const filters = parseFiltersFromSearchParams(raw);
  const sort = parseSortKey(first(params.sort));

  // The category rides through the shared search, so the grid, the live counts
  // and the story rail all read the same narrowed pool.
  const session = await getSession();
  const followed = followedSellerIds(session?.sub);

  const [listings, categoryPool, approved] = await Promise.all([
    searchListings(filters, category),
    searchListings(DEFAULT_FILTERS, category),
    approvedStories(),
  ]);

  const stories = storiesFrom(categoryPool, approved, STORIES[category], 6, followed);

  return {
    filters,
    sort,
    listings: boostFollowed(listings, followed),
    pool: categoryPool,
    stories,
  };
}
