import type { ListingCardData } from '@/lib/data/listings';
import { ListingCard } from './ListingCard';
import { ListingRow } from './ListingRow';
import type { ViewMode } from './SortControl';

export function ListingGrid({
  listings,
  view = 'grid',
}: {
  listings: ListingCardData[];
  view?: ViewMode;
}) {
  if (listings.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-12 text-center">
        <p className="font-extrabold">هنوز آگهی‌ای با این فیلترها یافت نشد.</p>
        <p className="mt-1 text-sm text-muted">
          فیلترها را ساده‌تر کنید یا اولین آگهی را شما ثبت کنید.
        </p>
      </div>
    );
  }

  if (view === 'row') {
    return (
      <ul className="flex flex-col gap-3">
        {listings.map((listing) => (
          <ListingRow key={listing.slug} listing={listing} />
        ))}
      </ul>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((listing) => (
        <ListingCard key={listing.slug} listing={listing} />
      ))}
    </ul>
  );
}
