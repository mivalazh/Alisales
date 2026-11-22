'use client';

import { useSearchParams } from 'next/navigation';
import type { ListingCardData } from '@/lib/data/listings';
import {
  byKind,
  filtersFromParams,
  visibleListings,
  type CatalogueParams,
} from '@/lib/catalogue';
import { parseSortKey } from '@/lib/sort';
import { useCatalogueRows } from '@/lib/use-catalogue-rows';
import {
  filterByPartCategory,
  filterPartsByAttributes,
  parsePartCategory,
} from '@/lib/browse';
import { Catalog } from './Catalog';
import {
  PartsFilterDrawer,
  activePartFilterCount,
  type PartFilterValues,
} from './PartFilterBar';
import type { StoryItem } from './Stories';
import { useI18n } from '@/lib/i18n';

/**
 * Client shell for the parts page.
 *
 * Same contract as the vehicle category shell (see CategoryCatalog.tsx): the
 * static page renders the parts pool, and category / origin / warranty /
 * compatibility / condition are read from the URL here. `PartsCatalogFallback`
 * is the default-filter render used for the prerendered HTML, because the view
 * receives `null` params and resolves the same defaults as the wrapper.
 */
type PartsCatalogueProps = {
  /** Every public parts listing, unfiltered. */
  pool: ListingCardData[];
  /** Unfiltered pool for the drawer's live counts (the static rows). */
  countPool?: ListingCardData[];
  stories: StoryItem[];
};

/** URL → the state this page renders. `null` resolves to the static defaults. */
function partsState(params: CatalogueParams) {
  return {
    filters: filtersFromParams(params),
    sort: parseSortKey(params?.get('sort')),
    values: {
      category: parsePartCategory(params?.get('category')),
      origin: params?.get('origin') ?? null,
      warranty: params?.get('warranty') === '1',
      compatibility: params?.get('compat') ?? '',
      condition: params?.get('pcond') ?? null,
    } satisfies PartFilterValues,
  };
}

function PartsCatalogueView({
  pool,
  countPool,
  stories,
  params,
  serverMatches = false,
}: PartsCatalogueProps & { params: CatalogueParams; serverMatches?: boolean }) {
  const { filters, sort, values } = partsState(params);
  const { t } = useI18n();
  const { category, origin, warranty, compatibility, condition } = values;
  const partCategory = parsePartCategory(category);

  // Server rows already matched the URL's shared filters; only the parts-only
  // attributes narrow them here. The route has no parts category (its `category`
  // is vehicle-only), so a fetched answer can carry cars too — keep it parts.
  const parts = byKind(serverMatches ? pool : visibleListings(pool, filters), 'part');
  const scoped = partCategory ? filterByPartCategory(parts, partCategory) : parts;
  const listings = filterPartsByAttributes(scoped, {
    origin,
    warrantyOnly: warranty,
    compatibility,
    condition,
  });

  return (
    <Catalog
      listings={listings}
      pool={countPool ?? pool}
      filters={filters}
      sort={sort}
      basePath="/parts"
      kind="part"
      showCategories={false}
      showStories
      stories={stories}
      storiesLabel={t('داستان‌های قطعات', 'Spare-part stories')}
      hideQuickChips
      searchPlaceholder={t(
        'جستجوی قطعه، شماره فنی یا نام خودرو...',
        'Search parts, part numbers or vehicle models...',
      )}
      filterSystem={{
        activeCount: activePartFilterCount(values),
        sheet: ({ open, onClose }) => (
          <PartsFilterDrawer
            open={open}
            basePath="/parts"
            value={values}
            pool={countPool ?? pool}
            onClose={onClose}
          />
        ),
        panel: ({ onClose }) => (
          <PartsFilterDrawer
            open
            variant="sidebar"
            basePath="/parts"
            value={values}
            pool={countPool ?? pool}
            onClose={onClose}
          />
        ),
      }}
    />
  );
}

export function PartsCatalog({ pool: staticPool, stories }: PartsCatalogueProps) {
  const params = useSearchParams();
  // After hydration the full matching pool replaces the rendered first 48.
  const { rows, serverMatches } = useCatalogueRows(staticPool, filtersFromParams(params));
  return (
    <PartsCatalogueView
      pool={rows}
      countPool={staticPool}
      stories={stories}
      params={params}
      serverMatches={serverMatches}
    />
  );
}

export function PartsCatalogFallback(props: PartsCatalogueProps) {
  return <PartsCatalogueView {...props} params={null} />;
}
