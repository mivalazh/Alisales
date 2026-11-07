'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  filtersToSearchParams,
  type SearchFilters,
  type VehicleCategory,
} from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import { sortListings, type SortKey } from '@/lib/sort';
import { CategoryCards } from './CategoryCards';
import { FilterBar, FilterSheet, FilterSidebar } from './FilterSystem';
import { FilterChips } from './FilterChips';
import { FilterPanel } from './FilterPanel';
import { ListingGrid } from './ListingGrid';
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
 * implementation; this client shell owns the brand box, the filter system,
 * the story rail, sort/view UX and commits changes to the URL so the server
 * re-runs that same search.
 *
 * Reading order on every browse page: search → optional brand box or parts
 * strip → stories → one control bar (فیلترها, active filter chips, count,
 * sort, grid/list) → results. The condition quick-chips that used to float
 * above the rail are gone; the filters live in the bar exactly where the
 * buyer expects them, directly above the grid.
 *
 * `basePath` keeps the same controls on the dedicated category pages
 * (`/cars`, `/motorcycles`, `/heavy`, `/parts`): every commit pushes to that
 * path instead of `/`.
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
  storiesLabel,
  pool,
  category,
  sortBar: _sortBar = 'top',
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
   * Category-specific filter strip (parts page). It replaces the generic
   * filter system and receives the shared commit handles.
   */
  filterStrip?: (ctx: CatalogContext) => ReactNode;
  /** The brand/model box — vehicles only, above the filters. */
  brandBox?: (ctx: CatalogContext) => ReactNode;
  hideQuickChips?: boolean;
  /** «داستان‌های خودرو» / «داستان‌های قطعات» — the rail's accessible title. */
  storiesLabel?: string;
  /**
   * Unfiltered result pool for the filter sidebar/sheet live counts. Defaults
   * to the rendered listings, which is right on the home page.
   */
  pool?: ListingCardData[];
  /** Enables the sidebar/sheet filter system for this vehicle category. */
  category?: VehicleCategory;
  /** Kept for page compatibility; the redundant heading is no longer shown. */
  heading?: string;
  sortBar?: 'top' | 'bottom';
}) {
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
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
  const filterPool = useMemo(() => pool ?? listings, [pool, listings]);

  const ctx: CatalogContext = {
    openPanel: () => setPanelOpen((v) => !v),
    filterCount,
    pool: filterPool,
    filters,
    commitFilters: (next) => commit(next, sort),
  };

  const genericFilterButton = (
    <button
      type="button"
      onClick={() => setPanelOpen((v) => !v)}
      aria-expanded={panelOpen}
      className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-line bg-card px-3 py-2 text-xs font-extrabold text-ink transition hover:border-line-strong"
    >
      <Icon name="sliders" size={15} />
      فیلترها
      {filterCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[10px] font-extrabold text-[color:var(--color-text-on-accent)]">
          {filterCount}
        </span>
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* A pick from the suggestion panel is a fresh search: it replaces the
          filters instead of stacking another brand on top of them. */}
      <SearchBar
        q={filters.q ?? ''}
        placeholder={searchPlaceholder}
        onApply={(patch) => commit({ ...DEFAULT_FILTERS, ...patch })}
      />

      {brandBox?.(ctx)}

      {showCategories && <CategoryCards vehicleCount={vehicleCount} partCount={partCount} />}

      {/* The rail sits directly above the control bar, so filters, chips, sort
          and view are the last thing seen before the grid on every page. */}
      {showStories && <Stories stories={stories} label={storiesLabel} />}

      {filterStrip && <div className={category ? 'lg:hidden' : undefined}>{filterStrip(ctx)}</div>}

      {/* One bar under the stories: filters, removable active chips, result
          count, sort and the grid/list switch — never a second stacked strip. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-card border border-line bg-card px-2.5 py-2">
        {category && (
          <FilterBar
            category={category}
            filters={filters}
            pool={filterPool}
            onOpen={() => setSheetOpen(true)}
            onChange={(next) => commit(next, sort)}
          />
        )}
        {!category && !filterStrip && genericFilterButton}

        <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChips filters={filters} onChange={(f) => commit(f)} />
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-2">
          <p className="text-xs font-bold text-muted" aria-live="polite">
            {listings.length} آگهی
          </p>
          <SortControl value={sort} onChange={(key) => commit(filters, key)} />
          <ViewModeToggle value={view} onChange={changeView} />
        </div>
      </div>

      {panelOpen && (
        <FilterPanel
          filters={filters}
          onChange={(f) => commit(f)}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {category ? (
        <div className="grid gap-4 lg:grid-cols-[264px_minmax(0,1fr)] lg:items-start">
          <FilterSidebar
            category={category}
            filters={filters}
            onChange={(next) => commit(next, sort)}
            onClear={() => commit({ ...DEFAULT_FILTERS, q: filters.q }, sort)}
            pool={filterPool}
          />
          <div className="min-w-0">
            <ListingGrid listings={sortListings(listings, sort)} view={view} />
          </div>
        </div>
      ) : (
        <ListingGrid listings={sortListings(listings, sort)} view={view} />
      )}

      {category && (
        <FilterSheet
          open={sheetOpen}
          category={category}
          filters={filters}
          pool={filterPool}
          onApply={(next) => {
            commit(next, sort);
            setSheetOpen(false);
          }}
          onClear={() => commit({ ...DEFAULT_FILTERS, q: filters.q }, sort)}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
