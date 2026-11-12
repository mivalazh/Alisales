import { CarLoader } from '@/components/CarLoader';
import { ListingGridSkeleton, Skeleton } from '@/components/Skeletons';

/** Root loading state: branded car loader over the catalogue skeleton. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-4" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-44" />
        <CarLoader size="md" />
      </div>
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
