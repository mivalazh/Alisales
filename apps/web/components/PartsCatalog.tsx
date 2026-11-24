'use client';

import { useSearchParams } from 'next/navigation';
import type { ListingCardData } from '@/lib/data/listings';
import {
  DEFAULT_CATALOGUE_STATE,
  byKind,
  catalogueState,
  narrowExtras,
  visibleListings,
  type CatalogueState,
} from '@/lib/catalogue';
import { useCatalogueRows } from '@/lib/use-catalogue-rows';
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

function PartsCatalogueView({
  pool,
  countPool,
  stories,
  state,
  serverMatches = false,
  nextCursor = null,
  onLoadMore,
  loadingMore = false,
}: PartsCatalogueProps & {
  state: CatalogueState;
  serverMatches?: boolean;
  nextCursor?: string | null;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}) {
  const { filters, sort, extras } = state;
  const { t } = useI18n();
  // The drawer speaks the parts-only URL shape; the state holds the same fields
  // already parsed.
  const values: PartFilterValues = {
    category: extras.partCategory,
    origin: extras.partAttributes.origin ?? null,
    warranty: extras.partAttributes.warrantyOnly ?? false,
    compatibility: extras.partAttributes.compatibility ?? '',
    condition: extras.partAttributes.condition ?? null,
  };

  // `/parts` is parts-only even when the URL carries no parts filter, so scope
  // by kind first; `narrowExtras` then applies whatever the URL did ask for.
  const listings = narrowExtras(
    byKind(serverMatches ? pool : visibleListings(pool, filters), 'part'),
    extras,
  );

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
      nextCursor={nextCursor}
      onLoadMore={onLoadMore}
      loadingMore={loadingMore}
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
  const state = catalogueState(params);
  const { rows, serverMatches, nextCursor, loadMore, loadingMore } = useCatalogueRows(
    staticPool,
    state,
  );
  return (
    <PartsCatalogueView
      pool={rows}
      countPool={staticPool}
      stories={stories}
      state={state}
      serverMatches={serverMatches}
      nextCursor={nextCursor}
      onLoadMore={loadMore}
      loadingMore={loadingMore}
    />
  );
}

export function PartsCatalogFallback(props: PartsCatalogueProps) {
  return <PartsCatalogueView {...props} state={DEFAULT_CATALOGUE_STATE} />;
}
