import { ListingGridSkeleton } from '@/components/ListingGridSkeleton';

/**
 * Home loading shell.
 *
 * Mirrors the real order — category tabs, rent banner, search, brand box, story
 * rail, control bar, grid — so the first paint already has the page's shape and
 * the listings settle into it without a shift.
 */
export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="در حال بارگذاری آگهی‌ها">
      <div className="mt-3 flex items-center justify-center gap-2 border-b border-line pb-2 sm:mt-4 sm:gap-4">
        {[64, 92, 80, 48].map((width, index) => (
          <span
            key={index}
            style={{ width }}
            className="h-3 animate-pulse rounded-full bg-sunken/50"
          />
        ))}
      </div>

      <div className="h-16 animate-pulse rounded-2xl bg-sunken/25" />
      <div className="h-11 animate-pulse rounded-full bg-sunken/40" />

      <div className="rounded-card border border-line bg-card p-3 sm:p-4">
        <div className="h-4 w-24 animate-pulse rounded-full bg-sunken/50" />
        <div className="mt-3 h-10 animate-pulse rounded-full bg-sunken/40" />
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => (
            <span key={index} className="h-12 animate-pulse rounded-lg bg-sunken/30" />
          ))}
        </div>
      </div>

      <div className="flex gap-3 overflow-hidden px-1 py-1">
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            key={index}
            className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-sunken/40"
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="h-10 w-32 animate-pulse rounded-full bg-sunken/40" />
        <span className="h-10 w-24 animate-pulse rounded-full bg-sunken/40" />
      </div>

      <ListingGridSkeleton />
    </div>
  );
}
