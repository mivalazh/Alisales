import { ListingGridSkeleton } from '@/components/ListingGridSkeleton';

/** Shell first, cards second: the page frame paints immediately and the grid
 *  streams in behind a skeleton instead of a blank region. */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-7 w-32 animate-pulse rounded-full bg-sunken/50" />
      <div className="h-11 w-full animate-pulse rounded-full bg-sunken/40" />
      <ListingGridSkeleton />
    </div>
  );
}
