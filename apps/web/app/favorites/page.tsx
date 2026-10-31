import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { listFavoriteIds, listingById } from '@/lib/data/s2-store';
import type { ListingCardData } from '@/lib/data/listings';
import { ListingCard } from '@/components/ListingCard';
import { FavoritesList } from '@/components/FavoritesList';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'علاقه‌مندی‌ها' };

/**
 * Favorites: an account list once signed in (source of truth for the owner
 * statistic), and the device-local list for guests so browsing stays useful
 * without an account.
 */
export default async function FavoritesPage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold">علاقه‌مندی‌ها</h1>
        <p className="text-xs text-muted">
          این فهرست روی همین دستگاه ذخیره شده است.{' '}
          <Link href="/login?next=/favorites" className="font-bold underline">
            وارد شوید
          </Link>{' '}
          تا علاقه‌مندی‌ها روی حساب شما بماند.
        </p>
        <FavoritesList />
      </div>
    );
  }

  const ids = await listFavoriteIds(session.sub);
  const resolved = await Promise.all(ids.map((id) => listingById(id)));
  const items = resolved.filter((listing): listing is ListingCardData => listing !== null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">علاقه‌مندی‌ها</h1>
      <p className="text-xs text-muted">ذخیره‌شده روی حساب شما.</p>

      {items.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-16 text-center">
          <Icon name="heart" size={40} className="mx-auto text-faint" />
          <p className="mt-4 font-extrabold">هنوز آگهی‌ای ذخیره نکرده‌اید.</p>
          <Link href="/" className="btn-cta mt-6 inline-flex text-sm">
            مرور آگهی‌ها
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </ul>
      )}
    </div>
  );
}
