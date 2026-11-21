'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { DEFAULT_FILTERS, type SearchFilters, type VehicleCategory } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import { filtersFromParams, visibleListings } from '@/lib/catalogue';
import { parseSortKey, type SortKey } from '@/lib/sort';
import { filterByBodyType, parseBodyType, type CarBodyType } from '@/lib/browse';
import { BrandModelBox } from './BrandModelBox';
import { Catalog } from './Catalog';
import type { StoryItem } from './Stories';

/**
 * Client shell for a vehicle category page (`/cars`, `/motorcycles`, `/heavy`).
 *
 * The page is statically generated: the server renders the whole category pool
 * once and this component narrows it from the URL (`?brand=`, `?sort=`,
 * `?body=`, …). No per-visitor data reaches the render, which is what lets the
 * document be cached at the edge and revalidated every minute.
 *
 * `CategoryCatalogFallback` renders the same markup with the default filters, so
 * the prerendered HTML is the real catalogue rather than an empty shell.
 */
function CategoryCatalogueView({
  category,
  pool,
  stories,
  storiesLabel,
  searchPlaceholder,
  heading,
  filters,
  sort,
  body,
}: {
  category: VehicleCategory;
  pool: ListingCardData[];
  stories: StoryItem[];
  storiesLabel: string;
  searchPlaceholder: string;
  heading: string;
  filters: SearchFilters;
  sort: SortKey;
  body: CarBodyType | null;
}) {
  const listings = useMemo(() => {
    const narrowed = visibleListings(pool, filters, category);
    return body ? filterByBodyType(narrowed, body) : narrowed;
  }, [pool, filters, category, body]);
  // Unfiltered category pool for the drawer's live counts.
  const categoryPool = useMemo(
    () => visibleListings(pool, DEFAULT_FILTERS, category),
    [pool, category],
  );

  return (
    <Catalog
      listings={listings}
      pool={categoryPool}
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

export function CategoryCatalog({
  category,
  pool,
  stories,
  storiesLabel,
  searchPlaceholder,
  heading,
}: {
  category: VehicleCategory;
  /** Every public listing in this category, unfiltered. */
  pool: ListingCardData[];
  stories: StoryItem[];
  storiesLabel: string;
  searchPlaceholder: string;
  heading: string;
}) {
  const params = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const sort = parseSortKey(params?.get('sort'));
  const body = parseBodyType(params?.get('body'));

  return (
    <CategoryCatalogueView
      category={category}
      pool={pool}
      stories={stories}
      storiesLabel={storiesLabel}
      searchPlaceholder={searchPlaceholder}
      heading={heading}
      filters={filters}
      sort={sort}
      body={body}
    />
  );
}

export function CategoryCatalogFallback(props: {
  category: VehicleCategory;
  pool: ListingCardData[];
  stories: StoryItem[];
  storiesLabel: string;
  searchPlaceholder: string;
  heading: string;
}) {
  return (
    <CategoryCatalogueView
      {...props}
      filters={DEFAULT_FILTERS}
      sort="newest"
      body={null}
    />
  );
}

export function categoryPath(category: VehicleCategory): string {
  if (category === 'motorcycle') return '/motorcycles';
  if (category === 'heavy') return '/heavy';
  return '/cars';
}
