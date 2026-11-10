import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FREE_LISTING_LIMIT, FREE_THIRD_LISTING_MESSAGE } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { listingsBySeller } from '@/lib/data/s2-store';
import { mergeMyListings, readMyListings } from '@/lib/data/my-listings-cookie';
import { ListingRow } from '@/components/ListingRow';
import { ListingOwnerActions } from '@/components/ListingOwnerActions';
import { PlanPreview } from '@/components/PlanPreview';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'آگهی‌های من' },
  { title: 'My listings' },
);

type Tab = 'active' | 'paused' | 'sold';

const TABS: ReadonlyArray<{ key: Tab; label: string; en: string }> = [
  { key: 'active', label: 'فعال', en: 'Active' },
  { key: 'paused', label: 'بایگانی‌شده', en: 'Archived' },
  { key: 'sold', label: 'فروخته‌شده', en: 'Sold' },
];

/**
 * Owner listings. «بایگانی‌شده» is a UI label for the existing `paused` state
 * (C5) — no enum change, no separate storage. Every row carries the owner
 * actions: edit, sold, archive and reactivate (the last one obeys the
 * two-active-listing free cap and shows the «بزودی» plan preview at the cap).
 */
export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [session, lang] = await Promise.all([getSession(), getLanguage()]);
  if (!session) redirect('/login?next=/profile/listings');
  const t = (fa: string, en: string) => serverT(lang, fa, en);

  const { tab } = await searchParams;
  const activeTab: Tab = tab === 'paused' || tab === 'sold' ? tab : 'active';

  // The signed cookie carries publishes that landed on another demo isolate.
  const mine = (await readMyListings()).filter((l) => l.sellerId === session.sub);
  const listings = mergeMyListings(mine, await listingsBySeller(session.sub));
  const shown = listings.filter((l) => l.state === activeTab);
  const activeCount = listings.filter((l) => l.state === 'active').length;
  const atCap = activeCount >= FREE_LISTING_LIMIT;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">{t('آگهی‌های من', 'My listings')}</h1>
        <Link href="/new" className="btn-cta text-sm">
          {t('ثبت آگهی', 'Post ad')}
        </Link>
      </div>

      <p className="text-xs text-muted">
        {t(
          `آگهی‌های فعال: ${activeCount} از ${FREE_LISTING_LIMIT}`,
          `Active listings: ${activeCount} of ${FREE_LISTING_LIMIT}`,
        )}
        {atCap && (
          <span className="mt-1 block font-bold text-warn">
            {t(FREE_THIRD_LISTING_MESSAGE, 'Choose a plan to publish a third listing.')}
          </span>
        )}
      </p>

      <nav
        aria-label={t('وضعیت آگهی‌ها', 'Listing status')}
        className="flex flex-wrap gap-2"
      >
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={`/profile/listings?tab=${item.key}`}
            aria-current={activeTab === item.key ? 'page' : undefined}
            className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm font-bold transition ${
              activeTab === item.key
                ? 'border-cta bg-cta-soft text-ink'
                : 'border-line bg-card text-muted hover:border-line-strong'
            }`}
          >
            {t(item.label, item.en)}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-12 text-center">
          <p className="font-extrabold">
            {t('در این بخش آگهی‌ای نیست.', 'There are no listings in this section.')}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t(
              'آگهی‌های بایگانی‌شده همان آگهی‌های متوقف‌شده هستند و هر زمان قابل بازفعال‌سازی‌اند.',
              'Archived listings are paused listings and can be reactivated at any time.',
            )}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              actions={<ListingOwnerActions id={listing.id} state={listing.state} />}
            />
          ))}
        </ul>
      )}

      {atCap && <PlanPreview />}
    </div>
  );
}
