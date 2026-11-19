/**
 * Card placeholders shown while a browse page streams its results in.
 *
 * They mirror the real card geometry — same 2/3/4-column grid, same photo
 * ratio, same text rhythm — so nothing jumps when the listings arrive. Pure
 * CSS pulses, no images and no animation library.
 */
export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      aria-hidden="true"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 [&>li]:min-w-0"
    >
      {Array.from({ length: count }).map((_, index) => (
        <li
          key={index}
          className="overflow-hidden rounded-card border border-line bg-card"
        >
          <div className="aspect-[5/4] animate-pulse bg-sunken/50 sm:aspect-[var(--photo-aspect)]" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-14 animate-pulse rounded-full bg-sunken/50" />
            <div className="h-3.5 w-full animate-pulse rounded-full bg-sunken/50" />
            <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-sunken/50" />
            <div className="h-4 w-24 animate-pulse rounded-full bg-sunken/50" />
          </div>
        </li>
      ))}
    </ul>
  );
}
