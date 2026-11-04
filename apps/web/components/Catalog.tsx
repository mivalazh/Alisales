'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  filtersToSearchParams,
  type SearchFilters,
} from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import { sortListings, type SortKey } from '@/lib/sort';
import { CategoryCards } from './CategoryCards';
import { FilterChips } from './FilterChips';
import { FilterPanel } from './FilterPanel';
import { ListingGrid } from './ListingGrid';
import { QuickChips } from './QuickChips';
import { SearchBar } from './SearchBar';
import { SortControl, ViewModeToggle, type ViewMode } from './SortControl';
import { Stories, type StoryItem } from './Stories';
import { Icon } from './Icon';

const VIEW_KEY = 'alisales-view';

/** Handles a category page's own filter bar needs from the catalog shell. */
export interface CatalogContext {
  openPanel: () => void;
  filterCount: number;
  pool: ListingCardData[];
  filters: SearchFilters;
  /** Commits a filter set to the URL (sort unchanged). */
  commitFilters: (next: SearchFilters) => void;
}

/**
 * Catalog container — server renders the listings from the one search
 * implementation; this client shell owns the story rail, the two category
 * cards, quick chips, filter/sort/view UX and commits changes to the URL so
 * the server re-runs that same search.
 *
 * `basePath` keeps the same controls on the dedicated category pages
 * (`/cars`, `/parts`): every commit pushes to that path instead of `/`.
 */
export function Catalog({
  listings,
  filters,
  sort,
  stories = [],
  kind = null,
  vehicleCount = 0,
  partCount = 0,
  basePath = '/',
  showCategories = true,
  showStories = true,
  searchPlaceholder,
  filterStrip,
  brandBox,
  hideQuickChips = false,
  storiesLabel,
  pool,
}: {
  listings: ListingCardData[];
  filters: SearchFilters;
  sort: SortKey;
  stories?: StoryItem[];
  kind?: 'vehicle' | 'part' | null;
  vehicleCount?: number;
  partCount?: number;
  basePath?: string;
  showCategories?: boolean;
  showStories?: boolean;
  searchPlaceholder?: string;
  /**
   * Category-specific filter strip (cars / parts). It replaces the generic
   * `فیلترها` row and receives the shared commit handles, so a page can own its
   * own pill bar without duplicating the search/catalog plumbing.
   */
  filterStrip?: (ctx: CatalogContext) => ReactNode;
  /** Slot under the strip — the vehicles page puts its brand/model box here. */
  brandBox?: (ctx: CatalogContext) => ReactNode;
  hideQuickChips?: boolean;
  /** «داستان‌های خودرو» / «داستان‌های قطعات» — the rail's accessible title. */
  storiesLabel?: string;
  /**
   * Unfiltered result pool for the filter modal's live count. Defaults to the
   * rendered listings, which is right on the home page (no strip).
   */
  pool?: ListingCardData[];
}) {
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(false);
  const [view, setView] = useState<ViewMode>('grid');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      if (stored === 'grid' || stored === 'row') setView(stored);
    } catch {
      // private mode — default view stays
    }
  }, []);

  const changeView = (mode: ViewMode) => {
    setView(mode);
    try {
      localStorage.setItem(VIEW_KEY, mode);
    } catch {
      // private mode — session-only view
    }
  };

  /** Commit filters/sort/kind to the URL (empty values omitted). */
  const commit = (
    next: SearchFilters,
    nextSort: SortKey = sort,
    nextKind: 'vehicle' | 'part' | null = kind,
  ) => {
    const params = filtersToSearchParams(next);
    if (nextSort !== 'newest') params.sort = nextSort;
    if (nextKind) params.kind = nextKind;
    const qs = new URLSearchParams(params).toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };

  const filterCount = activeFilterCount(filters);

  return (
    <div className="space-y-4">
      {/* A pick from the suggestion panel is a fresh search: it replaces the
          filters instead of stacking another brand on top of them. */}
      <SearchBar
        q={filters.q ?? ''}
        placeholder={searchPlaceholder}
        onApply={(patch) => commit({ ...DEFAULT_FILTERS, ...patch })}
      />

      {filterStrip
        ? filterStrip({
            openPanel: () => setPanelOpen((v) => !v),
            filterCount,
            pool: pool ?? listings,
            filters,
            commitFilters: (next) => commit(next, sort),
          })
        : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              aria-expanded={panelOpen}
              className="btn-ghost relative text-sm"
            >
              <Icon name="sliders" size={18} />
              فیلترها
              {filterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cta px-1 text-xs font-extrabold text-[color:var(--color-text-on-accent)]">
                  {filterCount}
                </span>
              )}
            </button>
          </div>
        )}

      {brandBox?.({
        openPanel: () => setPanelOpen((v) => !v),
        filterCount,
        pool: pool ?? listings,
        filters,
        commitFilters: (next) => commit(next, sort),
      })}

      {showStories && <Stories stories={stories} label={storiesLabel} />}

      {showCategories && <CategoryCards vehicleCount={vehicleCount} partCount={partCount} />}

      {!hideQuickChips && <QuickChips filters={filters} onChange={(f) => commit(f)} />}

      {panelOpen && (
        <FilterPanel
          filters={filters}
          onChange={(f) => commit(f)}
          onClose={() => setPanelOpen(false)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips filters={filters} onChange={(f) => commit(f)} />
        <div className="ms-auto flex items-center gap-3">
          <SortControl value={sort} onChange={(key) => commit(filters, key)} />
          <ViewModeToggle value={view} onChange={changeView} />
        </div>
      </div>

      <p className="text-sm font-bold text-muted" aria-live="polite">
        {listings.length} آگهی
      </p>

      <ListingGrid listings={sortListings(listings, sort)} view={view} />
    </div>
  );
}
