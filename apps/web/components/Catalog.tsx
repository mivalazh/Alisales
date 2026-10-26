'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  activeFilterCount,
  filtersToSearchParams,
  toPersianDigits,
  type SearchFilters,
} from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import { parseSortKey, sortListings, type SortKey } from '@/lib/sort';
import { FilterChips } from './FilterChips';
import { FilterPanel } from './FilterPanel';
import { ListingGrid } from './ListingGrid';
import { SearchBar } from './SearchBar';
import { SortControl, ViewModeToggle, type ViewMode } from './SortControl';
import { Icon } from './Icon';

const VIEW_KEY = 'alisales-view';

/**
 * Catalog container — server renders the listings from the one search
 * implementation; this client shell owns filter/sort/view UX and commits
 * filter+sort changes to the URL so the server re-runs that same search.
 */
export function Catalog({
  listings,
  filters,
  sort,
}: {
  listings: ListingCardData[];
  filters: SearchFilters;
  sort: SortKey;
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

  /** Commit filters/sort to the URL (empty values omitted). */
  const commit = (next: SearchFilters, nextSort: SortKey = sort) => {
    const params = filtersToSearchParams(next);
    if (nextSort !== 'newest') params.sort = nextSort;
    const qs = new URLSearchParams(params).toString();
    router.push(qs ? `/?${qs}` : '/');
  };

  const count = toPersianDigits(listings.length);
  const filterCount = activeFilterCount(filters);

  return (
    <div className="space-y-4">
      <SearchBar q={filters.q ?? ''} onSearch={(q) => commit({ ...filters, q })} />

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
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cta px-1 text-xs font-extrabold text-ink">
              {toPersianDigits(filterCount)}
            </span>
          )}
        </button>

        <div className="ms-auto flex items-center gap-3">
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

      <FilterChips filters={filters} onChange={(f) => commit(f)} />

      <p className="text-sm font-bold text-muted" aria-live="polite">
        {count} آگهی
      </p>

      <ListingGrid listings={sortListings(listings, sort)} view={view} />
    </div>
  );
}
