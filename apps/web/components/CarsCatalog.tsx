'use client';

import type { SearchFilters } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import type { SortKey } from '@/lib/sort';
import { BrandModelBox } from './BrandModelBox';
import { Catalog } from './Catalog';
import { VehicleFilterBar } from './VehicleFilterBar';
import type { StoryItem } from './Stories';

/**
 * Client shell for the vehicles page.
 *
 * The page itself is a server component (data, metadata, filters); the filter
 * strip and brand box are interactive and need the catalog's commit handle,
 * which only exists inside a client component — so this thin wrapper wires the
 * two into `Catalog` as render props. Nothing here fetches or filters on its
 * own: the URL still drives the server search.
 */
export function CarsCatalog({
  listings,
  pool,
  filters,
  sort,
  stories,
}: {
  listings: ListingCardData[];
  pool: ListingCardData[];
  filters: SearchFilters;
  sort: SortKey;
  stories: StoryItem[];
}) {
  return (
    <Catalog
      listings={listings}
      pool={pool}
      filters={filters}
      sort={sort}
      basePath="/cars"
      kind="vehicle"
      showCategories={false}
      showStories
      stories={stories}
      storiesLabel="داستان‌های خودرو"
      hideQuickChips
      searchPlaceholder="جستجو در خودروها..."
      filterStrip={({ filters: current, pool: resultPool, commitFilters }) => (
        <VehicleFilterBar filters={current} pool={resultPool} onChange={commitFilters} />
      )}
      brandBox={({ filters: current, commitFilters }) => (
        <BrandModelBox
          brand={current.brand[0] ?? ''}
          model={current.model ?? ''}
          onPick={(brandSlug, model) =>
            commitFilters({
              ...current,
              brand: brandSlug ? [brandSlug as (typeof current.brand)[number]] : [],
              model: model ?? '',
            })
          }
        />
      )}
    />
  );
}
