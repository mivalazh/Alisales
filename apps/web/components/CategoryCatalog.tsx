'use client';

import { useSearchParams } from 'next/navigation';
import { DEFAULT_FILTERS, type VehicleCategory } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import {
  filtersFromParams,
  visibleListings,
  type CatalogueParams,
} from '@/lib/catalogue';
import { parseSortKey } from '@/lib/sort';
import { useCatalogueRows } from '@/lib/use-catalogue-rows';
import { filterByBodyType, parseBodyType } from '@/lib/browse';
import { BrandModelBox } from './BrandModelBox';
import { Catalog } from './Catalog';
import type { StoryItem } from './Stories';

/**
 * Client shell for a vehicle category page (`/cars`, `/motorcycles`, `/heavy`).
 *
 * The page is statically generated: the server renders the whole category pool
 * once and the catalogue narrows it from the URL (`?brand=`, `?sort=`,
 * `?body=`, …). No per-visitor data reaches the render, which is what lets the
 * document be cached at the edge and revalidated every minute.
 *
 * `CategoryCatalogueView` stays free of navigation and data hooks: it receives
 * the URL params as a prop (`null` while prerendering), so the static shell and
 * the hydrated wrapper render from exactly the same state. The fallback below
 * passes `null`; it cannot drift from the wrapper because neither repeats the
 * derived filter state.
 */
type CategoryCatalogueProps = {
  category: VehicleCategory;
  /** Every public listing in this category, unfiltered. */
  pool: ListingCardData[];
  /** Unfiltered pool for the drawer's live counts (the static rows). */
  countPool?: ListingCardData[];
  stories: StoryItem[];
  storiesLabel: string;
  searchPlaceholder: string;
  heading: string;
};

/** URL → the state this page renders. `null` resolves to the static defaults. */
function catalogueState(params: CatalogueParams) {
  return {
    filters: filtersFromParams(params),
    sort: parseSortKey(params?.get('sort')),
    body: parseBodyType(params?.get('body')),
  };
}

function CategoryCatalogueView({
  category,
  pool,
  countPool,
  stories,
  storiesLabel,
  searchPlaceholder,
  heading,
  params,
  serverMatches = false,
}: CategoryCatalogueProps & { params: CatalogueParams; serverMatches?: boolean }) {
  const { filters, sort, body } = catalogueState(params);
  // Server rows already carry the URL's filters, and the hosted q match is
  // wider than the local fuzzy predicate (it reads the description too), so
  // re-filtering them would drop real hits.
  const narrowed = serverMatches ? pool : visibleListings(pool, filters, category);
  const listings = body ? filterByBodyType(narrowed, body) : narrowed;
  // Unfiltered category pool for the drawer's live counts.
  const categoryPool = visibleListings(countPool ?? pool, DEFAULT_FILTERS, category);

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
  pool: staticPool,
  ...props
}: CategoryCatalogueProps) {
  const params = useSearchParams();
  // The static pool is the first paint; URL filters fetch their own matches so
  // a brand or keyword can reach beyond the rows rendered in the document.
  const { rows, serverMatches } = useCatalogueRows(
    staticPool,
    filtersFromParams(params),
    props.category,
  );
  return (
    <CategoryCatalogueView
      {...props}
      pool={rows}
      countPool={staticPool}
      params={params}
      serverMatches={serverMatches}
    />
  );
}

export function CategoryCatalogFallback(props: CategoryCatalogueProps) {
  return <CategoryCatalogueView {...props} params={null} />;
}

export function categoryPath(category: VehicleCategory): string {
  if (category === 'motorcycle') return '/motorcycles';
  if (category === 'heavy') return '/heavy';
  return '/cars';
}
