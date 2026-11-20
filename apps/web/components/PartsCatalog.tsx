'use client';

import type { SearchFilters } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import type { SortKey } from '@/lib/sort';
import { Catalog } from './Catalog';
import {
  PartsFilterDrawer,
  activePartFilterCount,
  type PartFilterValues,
} from './PartFilterBar';
import type { StoryItem } from './Stories';
import { useI18n } from '@/lib/i18n';

/**
 * Client shell for the parts page: category / origin / warranty / compatibility
 * live in their own URL params, so they are passed into the shared catalog
 * filter slots rather than rendered as a horizontal strip.
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
  const { t } = useI18n();
  const partValues: PartFilterValues = {
    category,
    origin,
    warranty,
    compatibility,
    condition,
  };

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
        activeCount: activePartFilterCount(partValues),
        sheet: ({ open, onClose }) => (
          <PartsFilterDrawer
            open={open}
            basePath="/parts"
            value={partValues}
            pool={pool}
            onClose={onClose}
          />
        ),
        panel: ({ onClose }) => (
          <PartsFilterDrawer
            open
            variant="sidebar"
            basePath="/parts"
            value={partValues}
            pool={pool}
            onClose={onClose}
          />
        ),
      }}
    />
  );
}
