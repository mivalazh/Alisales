'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
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
import { FilterBar, FilterDrawer } from './FilterSystem';
import { FilterChips } from './FilterChips';
import { FilterPanel } from './FilterPanel';
import { ListingGrid } from './ListingGrid';
import { SearchBar } from './SearchBar';
import { SortControl, ViewModeToggle, type ViewMode } from './SortControl';
import { Stories, type StoryItem } from './Stories';
import { Icon } from './Icon';
import { CarLoader } from './CarLoader';
import { EndOfFeed } from './EndOfFeed';
import { useDelayedBusy } from '@/lib/useDelayedBusy';
import { useI18n } from '@/lib/i18n';

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
 * A complete alternate filter surface. `/parts` uses this to render the same
 * right-hand drawer geometry as `/cars` while keeping its own
 * category/origin/condition URL params.
 */
export interface CatalogFilterSlots {
  activeCount: number;
  sheet: (props: { open: boolean; onClose: () => void }) => ReactNode;
  /** Desktop right-hand column, beside the grid rather than over it. */
  panel?: (props: { onClose: () => void }) => ReactNode;
}

/**
 * Catalog container — server renders the listings from the one search
 * implementation; this client shell owns the brand box, the filter system,
 * the story rail, sort/view UX and commits changes to the URL so the server
 * re-runs that same search.
 *
 * Reading order on every browse page: search → optional brand box → stories →
 * one control bar (فیلترها, active filter chips, count, sort, grid/list) →
 * results. The filters live in the bar exactly where the buyer expects them,
 * directly above the grid.
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
  brandBox,
  storiesLabel,
  pool,
  category,
  filterSystem,
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
  /** The brand/model box — vehicles only, above the filters. */
  brandBox?: (ctx: CatalogContext) => ReactNode;
  hideQuickChips?: boolean;
  /** «داستان‌های خودرو» / «داستان‌های قطعات» — the rail's accessible title. */
  storiesLabel?: string;
  /**
   * Unfiltered result pool for the filter drawer's live counts. Defaults
   * to the rendered listings, which is right on the home page.
   */
  pool?: ListingCardData[];
  /** Enables the built-in drawer filter system for this vehicle category. */
  category?: VehicleCategory;
  /** A custom drawer, currently used by the parts catalog. */
  filterSystem?: CatalogFilterSlots;
  /** Kept for page compatibility; the redundant heading is no longer shown. */
  heading?: string;
  sortBar?: 'top' | 'bottom';
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [panelOpen, setPanelOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Category filters are a right-hand column from `lg`, exactly like home.
  // Only one surface is mounted at a time so focus handling never doubles up.
  const [wide, setWide] = useState(false);
  const [view, setView] = useState<ViewMode>('grid');
  const [isPending, startTransition] = useTransition();
  const showPending = useDelayedBusy(isPending);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(VIEW_KEY);
      if (stored === 'grid' || stored === 'row') setView(stored);
    } catch {
      // private mode — default view stays
    }
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
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
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath);
    });
  };

  const filterCount = activeFilterCount(filters);
  const filterPool = useMemo(() => pool ?? listings, [pool, listings]);
  const sortedListings = useMemo(() => sortListings(listings, sort), [listings, sort]);

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
      className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-line bg-card px-2.5 py-1.5 text-[11px] font-extrabold text-ink transition hover:border-line-strong sm:min-h-10 sm:px-3 sm:py-2 sm:text-xs"
    >
      <Icon name="sliders" size={15} />
      {t('فیلترها', 'Filters')}
      {filterCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[10px] font-extrabold text-[color:var(--color-text-on-accent)]">
          {filterCount}
        </span>
      )}
    </button>
  );

  const customFilterButton = filterSystem ? (
    <button
      type="button"
      onClick={() => setSheetOpen(true)}
      aria-expanded={sheetOpen}
      className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-line bg-card px-2.5 py-1.5 text-[11px] font-extrabold text-ink transition hover:border-line-strong sm:min-h-10 sm:px-3 sm:py-2 sm:text-xs"
    >
      <Icon name="sliders" size={15} />
      {t('فیلترها', 'Filters')}
      {filterSystem.activeCount > 0 && (
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[10px] font-extrabold text-[color:var(--color-text-on-accent)]">
          {filterSystem.activeCount}
        </span>
      )}
    </button>
  ) : null;

  return (
    <div className="space-y-4">
      {showPending && (
        <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
          {/* No scrim on this layer: the 44px wheel reads over live results, a
              wordmark would land on the card above it, so it stays wordless. */}
          <CarLoader inline size="md" label={t('در حال به‌روزرسانی نتایج', 'Updating results')} />
        </div>
      )}

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

      {/* One compact row under the stories: filters, sort and the grid/list
          switch. The result count lives in the results themselves. */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-card p-2">
        {category && (
          <FilterBar
            category={category}
            filters={filters}
            pool={filterPool}
            onOpen={() => setSheetOpen(true)}
            onChange={(next) => commit(next, sort)}
          />
        )}
        {!category && !filterSystem && genericFilterButton}
        {customFilterButton}

        <div className="ms-auto flex min-w-0 shrink-0 items-center gap-2">
          <SortControl value={sort} onChange={(key) => commit(filters, key)} />
          <ViewModeToggle value={view} onChange={changeView} />
        </div>
      </div>

      {/* Active filter chips get their own wrapping row below the control bar.
          Keeping them out of the sort box means a long chip list can never
          squeeze «حذف همه» / the count into clipped vertical text. */}
      {filterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-card px-2.5 py-2">
          <FilterChips filters={filters} onChange={(f) => commit(f)} />
        </div>
      )}

      {/* Desktop: the home filter is a right-hand column beside the grid — the
          same geometry as the /cars drawer, so opening «فیلترها» narrows the
          results instead of covering or pushing them away. Phones and tablets
          keep the inline card below, where a column would not fit. */}
      <div className="lg:flex lg:items-start lg:gap-4">
        {/* Category pages (/cars, /motorcycles, /heavy, /parts) use the same
            right-hand column as home: `w-72`, sticky under the header, never
            over the results. */}
        {sheetOpen && wide && (filterSystem?.panel || category) && (
          <aside className="hidden w-72 shrink-0 lg:sticky lg:top-[8.5rem] lg:block lg:self-start">
            {filterSystem?.panel
              ? filterSystem.panel({ onClose: () => setSheetOpen(false) })
              : category && (
                  <FilterDrawer
                    open
                    variant="sidebar"
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
          </aside>
        )}

        {/* Sticky offset clears the two-row site header (122px) with a gap;
            sticking at `top-24` slid the panel's own header behind it. */}
        {panelOpen && (
          <aside className="hidden w-72 shrink-0 lg:sticky lg:top-[8.5rem] lg:block lg:self-start">
            <FilterPanel
              variant="sidebar"
              filters={filters}
              onChange={(f) => commit(f)}
              onClear={() => commit({ ...DEFAULT_FILTERS, q: filters.q })}
              onClose={() => setPanelOpen(false)}
            />
          </aside>
        )}

        <div className="min-w-0 flex-1 space-y-4">
          <ListingGrid listings={sortedListings} view={view} />
          <EndOfFeed count={sortedListings.length} />
        </div>
      </div>

      {panelOpen && (
        <div className="lg:hidden">
          <FilterPanel
            filters={filters}
            onChange={(f) => commit(f)}
            onClear={() => commit({ ...DEFAULT_FILTERS, q: filters.q })}
            onClose={() => setPanelOpen(false)}
          />
        </div>
      )}

      {!wide &&
        (filterSystem
          ? filterSystem.sheet({
              open: sheetOpen,
              onClose: () => setSheetOpen(false),
            })
          : category && (
              <FilterDrawer
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
            ))}
    </div>
  );
}
