'use client';

import type { SearchFilters, VehicleCategory } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import type { SortKey } from '@/lib/sort';
import { BrandModelBox } from './BrandModelBox';
import { Catalog } from './Catalog';
import type { StoryItem } from './Stories';

/**
 * Client shell for a vehicle category page (`/cars`, `/motorcycles`, `/heavy`).
 *
 * The page itself is a server component (data, metadata, filters); the brand
 * box and filter system need the catalog's commit handle, which only exists
 * inside a client component — so this thin wrapper wires them into `Catalog`.
 * Nothing here fetches or filters on its own: the URL still drives the server
 * search.
 */
export function CategoryCatalog({
  category,
  listings,
  pool,
  filters,
  sort,
  stories,
  storiesLabel,
  searchPlaceholder,
  heading,
}: {
  category: VehicleCategory;
  listings: ListingCardData[];
  pool: ListingCardData[];
  filters: SearchFilters;
  sort: SortKey;
  stories: StoryItem[];
  storiesLabel: string;
  searchPlaceholder: string;
  heading: string;
}) {
  return (
    <Catalog
      listings={listings}
      pool={pool}
      filters={filters}
      sort={sort}
      basePath={categoryPath(category)}
      kind="vehicle"
      category={category}
      heading={heading}
      showCategories={false}
      showStories
      stories={stories}
      storiesLabel={storiesLabel}
      hideQuickChips
      searchPlaceholder={searchPlaceholder}
      brandBox={({ filters: current, commitFilters }) => (
        <BrandModelBox
          category={category}
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

export function categoryPath(category: VehicleCategory): string {
  if (category === 'motorcycle') return '/motorcycles';
  if (category === 'heavy') return '/heavy';
  return '/cars';
}
