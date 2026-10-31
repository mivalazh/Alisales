import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FREE_LISTING_LIMIT, FREE_THIRD_LISTING_MESSAGE } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { listingsBySeller } from '@/lib/data/s2-store';
import { ListingRow } from '@/components/ListingRow';

export const metadata: Metadata = { title: 'آگهی‌های من' };

type Tab = 'active' | 'paused' | 'sold';

const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: 'active', label: 'فعال' },
  { key: 'paused', label: 'بایگانی‌شده' },
  { key: 'sold', label: 'فروخته‌شده' },
];

/**
 * Owner listings. «بایگانی‌شده» is a UI label for the existing `paused` state
 * (C5) — no enum change, no separate storage.
 */
export default async function MyListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login?next=/profile/listings');

  const { tab } = await searchParams;
  const activeTab: Tab = tab === 'paused' || tab === 'sold' ? tab : 'active';

  const listings = await listingsBySeller(session.sub);
  const shown = listings.filter((l) => l.state === activeTab);
  const activeCount = listings.filter((l) => l.state === 'active').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">آگهی‌های من</h1>
        <Link href="/new" className="btn-cta text-sm">
          ثبت آگهی
        </Link>
      </div>

      <p className="text-xs text-muted">
        آگهی‌های فعال: {activeCount} از {FREE_LISTING_LIMIT}
        {activeCount >= FREE_LISTING_LIMIT && (
          <span className="mt-1 block font-bold text-warn">{FREE_THIRD_LISTING_MESSAGE}</span>
        )}
      </p>

      <nav aria-label="وضعیت آگهی‌ها" className="flex flex-wrap gap-2">
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
            {item.label}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-12 text-center">
          <p className="font-extrabold">در این بخش آگهی‌ای نیست.</p>
          <p className="mt-1 text-sm text-muted">
            آگهی‌های بایگانی‌شده همان آگهی‌های متوقف‌شده هستند و هر زمان قابل بازفعال‌سازی‌اند.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((listing) => (
            <ListingRow key={listing.id} listing={listing} />
          ))}
        </ul>
      )}
    </div>
  );
}
