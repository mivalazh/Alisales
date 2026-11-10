import { ListingGridSkeleton, Skeleton } from '@/components/Skeletons';

/** Root loading state: title, filter bar and catalogue cards, no spinner. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-44" />
      <div className="flex gap-2 overflow-hidden">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
      <ListingGridSkeleton />
    </div>
  );
}
