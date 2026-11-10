/** Shared shimmer block — the only loading texture across route skeletons. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`skeleton block rounded-lg ${className}`} />;
}

export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      aria-hidden
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="overflow-hidden rounded-card border border-line bg-card"
        >
          <Skeleton className="aspect-[var(--photo-aspect)] w-full rounded-none" />
          <div className="space-y-2 p-3 sm:p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
        </li>
      ))}
    </ul>
  );
}
