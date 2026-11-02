import type { Metadata } from 'next';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { listFavoriteIds, listingById } from '@/lib/data/s2-store';
import type { ListingCardData } from '@/lib/data/listings';
import { ListingCard } from '@/components/ListingCard';
import { ListingRow } from '@/components/ListingRow';
import { FavoritesList } from '@/components/FavoritesList';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'علاقه‌مندی‌ها' };

/**
 * Favorites: an account list once signed in (source of truth for the owner
 * statistic), and the device-local list for guests so browsing stays useful
 * without an account. Both views use a 2-column phone / 4-column desktop grid
 * with a list toggle (`?view=row` for accounts, device state for guests).
 */
export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getSession();
  const { view } = await searchParams;
  const rowView = view === 'row';

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
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-muted">{items.length} آگهی</p>
            <div
              role="group"
              aria-label="نحوه نمایش"
              className="flex items-center rounded-[var(--radius-pill)] border border-line bg-card p-1"
            >
              {(
                [
                  { mode: 'grid', icon: 'grid', label: 'نمایش شبکه‌ای', href: '/favorites' },
                  { mode: 'row', icon: 'list', label: 'نمایش فهرستی', href: '/favorites?view=row' },
                ] as const
              ).map((option) => {
                const active = (option.mode === 'row') === rowView;
                return (
                  <Link
                    key={option.mode}
                    href={option.href}
                    aria-pressed={active}
                    aria-label={option.label}
                    title={option.label}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                      active ? 'bg-cta-soft text-ink' : 'text-faint hover:text-ink'
                    }`}
                  >
                    <Icon name={option.icon} size={18} />
                  </Link>
                );
              })}
            </div>
          </div>

          {rowView ? (
            <ul className="flex flex-col gap-3">
              {items.map((listing) => (
                <ListingRow key={listing.id} listing={listing} />
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
