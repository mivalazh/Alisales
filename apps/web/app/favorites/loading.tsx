import { ListingGridSkeleton, Skeleton } from '@/components/Skeletons';

export default function FavoritesLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true" aria-label="Loading saved listings">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-3 w-44" />
      <ListingGridSkeleton count={4} />
    </div>
  );
}
