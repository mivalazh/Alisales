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
 * implementation; this client shell owns the brand box, the filter system,
 * the story rail, quick chips, sort/view UX and commits changes to the URL so
 * the server re-runs that same search.
 *
 * Order on a vehicle page (top to bottom): search → brand box (with its model
 * row) → filters → stories → chips → sort → grid. Desktop carries the filters
 * in a left sidebar; phones get one «فیلترها» button that opens a bottom sheet.
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
  hideQuickChips = false,
  storiesLabel,
  pool,
  category,
  heading,
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
  /** Small caption above the count («خودروها»، «موتورسیکلت‌ها» …). */
  heading?: string;
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

  const content = (
    <div className="space-y-4">
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

      <p className="text-sm font-bold text-muted" aria-live="polite">
        {heading ? `${heading} · ` : ''}
        {listings.length} آگهی
      </p>

      <ListingGrid listings={sortListings(listings, sort)} view={view} />
    </div>
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

      {/* The pill strip (removable filter chips + sort/view) sits *below* the
          brand and model selectors, so a brand pick never pushes it out of
          reach and the active filters read directly above the results. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips filters={filters} onChange={(f) => commit(f)} />
        <div className="ms-auto flex items-center gap-3">
          <SortControl value={sort} onChange={(key) => commit(filters, key)} />
          <ViewModeToggle value={view} onChange={changeView} />
        </div>
      </div>

      {category && (
        <FilterBar
          category={category}
          filters={filters}
          pool={filterPool}
          onOpen={() => setSheetOpen(true)}
          onChange={(next) => commit(next, sort)}
        />
      )}

      {filterStrip && <div className={category ? 'lg:hidden' : undefined}>{filterStrip(ctx)}</div>}

      {category ? (
        <div className="grid gap-4 lg:grid-cols-[264px_minmax(0,1fr)] lg:items-start">
          <FilterSidebar
            category={category}
            filters={filters}
            onChange={(next) => commit(next, sort)}
            onClear={() => commit({ ...DEFAULT_FILTERS, q: filters.q }, sort)}
            pool={filterPool}
          />
          {content}
        </div>
      ) : (
        content
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

      {/* The generic panel is the fallback for pages without a category. */}
      {!category && !filterStrip && (
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
    </div>
  );
}
