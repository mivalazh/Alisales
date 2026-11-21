'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { DEFAULT_FILTERS, type SearchFilters } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import { filtersFromParams, visibleListings } from '@/lib/catalogue';
import { parseSortKey, type SortKey } from '@/lib/sort';
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
 * is the default-filter render used for the prerendered HTML.
 */
function PartsCatalogueView({
  pool,
  stories,
  filters,
  sort,
  values,
}: {
  pool: ListingCardData[];
  stories: StoryItem[];
  filters: SearchFilters;
  sort: SortKey;
  values: PartFilterValues;
}) {
  const { t } = useI18n();
  const { category, origin, warranty, compatibility, condition } = values;
  const partCategory = parsePartCategory(category);

  const listings = useMemo(() => {
    const parts = visibleListings(pool, filters);
    const scoped = partCategory ? filterByPartCategory(parts, partCategory) : parts;
    return filterPartsByAttributes(scoped, {
      origin,
      warrantyOnly: warranty,
      compatibility,
      condition,
    });
  }, [pool, filters, partCategory, origin, warranty, compatibility, condition]);

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
            pool={pool}
            onClose={onClose}
          />
        ),
        panel: ({ onClose }) => (
          <PartsFilterDrawer
            open
            variant="sidebar"
            basePath="/parts"
            value={values}
            pool={pool}
            onClose={onClose}
          />
        ),
      }}
    />
  );
}

export function PartsCatalog({
  pool,
  stories,
}: {
  /** Every public parts listing, unfiltered. */
  pool: ListingCardData[];
  stories: StoryItem[];
}) {
  const params = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const sort = parseSortKey(params?.get('sort'));
  const values: PartFilterValues = {
    category: parsePartCategory(params?.get('category')),
    origin: params?.get('origin') ?? null,
    warranty: params?.get('warranty') === '1',
    compatibility: params?.get('compat') ?? '',
    condition: params?.get('pcond') ?? null,
  };

  return (
    <PartsCatalogueView
      pool={pool}
      stories={stories}
      filters={filters}
      sort={sort}
      values={values}
    />
  );
}

export function PartsCatalogFallback({
  pool,
  stories,
}: {
  pool: ListingCardData[];
  stories: StoryItem[];
}) {
  return (
    <PartsCatalogueView
      pool={pool}
      stories={stories}
      filters={DEFAULT_FILTERS}
      sort="newest"
      values={{
        category: null,
        origin: null,
        warranty: false,
        compatibility: '',
        condition: null,
      }}
    />
  );
}
