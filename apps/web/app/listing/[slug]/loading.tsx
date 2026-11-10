import { Skeleton } from '@/components/Skeletons';

export default function ListingLoading() {
  return (
    <div
      className="mx-auto max-w-6xl space-y-5"
      aria-busy="true"
      aria-label="Loading listing"
    >
      <Skeleton className="h-4 w-32" />
      <div className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-3 lg:col-span-7">
          <Skeleton className="aspect-[16/10] w-full rounded-card" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-20 rounded-field" />
            ))}
          </div>
        </div>
        <div className="space-y-3 lg:col-span-5">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-10 w-3/5" />
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-20 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
