'use client';

import type { SearchFilters } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import type { SortKey } from '@/lib/sort';
import { Catalog } from './Catalog';
import { PartFilterBar } from './PartFilterBar';
import type { StoryItem } from './Stories';

/**
 * Client shell for the parts page: the spare-parts strip needs its own URL
 * params (category / origin / warranty / compatibility) and the catalog's
 * filter commit, so the wiring lives on the client while the page keeps doing
 * the server-side search, scoping and metadata.
 */
export function PartsCatalog({
  listings,
  pool,
  filters,
  sort,
  stories,
  category,
  origin,
  warranty,
  compatibility,
  condition,
}: {
  listings: ListingCardData[];
  pool: ListingCardData[];
  filters: SearchFilters;
  sort: SortKey;
  stories: StoryItem[];
  category: string | null;
  origin: string | null;
  warranty: boolean;
  compatibility: string;
  condition: string | null;
}) {
  return (
    <Catalog
      listings={listings}
      pool={pool}
      filters={filters}
      sort={sort}
      basePath="/parts"
      kind="part"
      showCategories={false}
      showStories
      stories={stories}
      storiesLabel="داستان‌های قطعات"
      hideQuickChips
      searchPlaceholder="جستجوی قطعه، شماره فنی یا نام خودرو..."
      filterStrip={({ filters: current, commitFilters }) => (
        <PartFilterBar
          basePath="/parts"
          category={category}
          origin={origin}
          warranty={warranty}
          compatibility={compatibility}
          condition={condition}
          filters={current}
          onChange={commitFilters}
        />
      )}
    />
  );
}
