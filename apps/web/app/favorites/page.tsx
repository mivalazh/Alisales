import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { listFavoriteIds, listingById } from '@/lib/data/s2-store';
import type { ListingCardData } from '@/lib/data/listings';
import { ListingCard } from '@/components/ListingCard';
import { ListingRow } from '@/components/ListingRow';
import { FavoritesList } from '@/components/FavoritesList';
import { Icon } from '@/components/Icon';
import { ListEmptyState } from '@/components/ListEmptyState';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'ذخیره‌شده‌ها' },
  { title: 'Saved' },
);

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
  const [session, lang] = await Promise.all([getSession(), getLanguage()]);
  const t = (fa: string, en: string) => serverT(lang, fa, en);
  const { view } = await searchParams;
  const rowView = view === 'row';

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 bg-[#F4F1EC] dark:bg-[#0B0D1E]">
        <h1 className="text-xl font-extrabold dark:text-white">{t('ذخیره‌شده‌ها', 'Saved')}</h1>
        <p className="text-xs text-muted">
          {t('این فهرست روی همین دستگاه ذخیره شده است.', 'This list is stored on this device.')}{' '}
          <Link href="/login?next=/favorites" className="font-bold underline">
            {t('وارد شوید', 'Sign in')}
          </Link>{' '}
          {t(
            'تا ذخیره‌شده‌ها روی حساب شما بماند.',
            'to keep your saved listings on your account.',
          )}
        </p>
        <FavoritesList />
      </div>
    );
  }

  const ids = await listFavoriteIds(session.sub);
  const resolved = await Promise.all(ids.map((id) => listingById(id)));
  const items = resolved.filter((listing): listing is ListingCardData => listing !== null);

  return (
    <div className="mx-auto max-w-2xl space-y-4 bg-[#F4F1EC] dark:bg-[#0B0D1E]">
      <h1 className="text-xl font-extrabold dark:text-white">{t('ذخیره‌شده‌ها', 'Saved')}</h1>

      {items.length === 0 ? (
        <ListEmptyState
          icon="bookmark"
          title={t('هنوز آگهی‌ای ذخیره نکرده‌اید.', 'You have not saved any listings yet.')}
          description={t(
            'با ذخیره کردن آگهی‌ها، اینجا فهرست شخصی خود را می‌سازید.',
            'Save listings with the bookmark and they will appear here.',
          )}
          actionHref="/"
          actionLabel={t('مرور آگهی‌ها', 'Browse listings')}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-muted">
              {t(`${items.length} آگهی`, `${items.length} listings`)}
            </p>
            <div
              role="group"
              aria-label={t('نحوه نمایش', 'Display mode')}
              className="flex items-center rounded-[var(--radius-pill)] border border-line bg-card p-1 dark:border-white/10 dark:bg-[#131735]/90"
            >
              {(
                [
                  {
                    mode: 'grid',
                    icon: 'grid',
                    label: t('نمایش شبکه‌ای', 'Grid view'),
                    href: '/favorites',
                  },
                  {
                    mode: 'row',
                    icon: 'list',
                    label: t('نمایش فهرستی', 'List view'),
                    href: '/favorites?view=row',
                  },
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
