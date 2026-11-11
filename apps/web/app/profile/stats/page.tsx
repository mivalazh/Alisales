import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  OWNER_STATS_SORTS,
  OWNER_STATS_SORT_LABELS,
  formatPriceLatin,
  parseOwnerStatsSort,
  sortOwnerStats,
  totalOwnerStats,
} from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { listingsBySeller, ownerStats } from '@/lib/data/s2-store';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'آمار آگهی‌ها' },
  { title: 'Listing statistics' },
);

/**
 * Owner statistics (C2). Reads only the signed-in account's listings; the
 * store scopes every query by the session id, and the database grants read
 * access on the counters to the listing owner alone.
 *
 * Sorting is display-only: «بیشترین تماس» ranks by reveals + new chats while
 * the table keeps the two counters in separate columns.
 */
export default async function OwnerStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const [session, lang] = await Promise.all([getSession(), getLanguage()]);
  if (!session) redirect('/login?next=/profile/stats');
  const t = (fa: string, en: string) => serverT(lang, fa, en);
  const sortEn: Record<string, string> = {
    newest: 'Newest',
    views: 'Most viewed',
    contacts: 'Most contacted',
  };

  const { sort: sortParam } = await searchParams;
  const sort = parseOwnerStatsSort(sortParam);

  const [listings, stats] = await Promise.all([
    listingsBySeller(session.sub),
    ownerStats(session.sub),
  ]);
  const listingById = new Map(listings.map((l) => [l.id, l]));
  const totals = totalOwnerStats(stats);
  const publishedAtById = Object.fromEntries(listings.map((l) => [l.id, l.publishedAt]));
  const rows = sortOwnerStats(stats, sort, publishedAtById);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">{t('آمار آگهی‌ها', 'Listing analytics')}</h1>
        <Link href="/profile" className="text-xs font-bold text-muted underline">
          {t('بازگشت به پروفایل', 'Back to profile')}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: t('بازدید', 'Views'), value: totals.views },
          { label: t('گفتگوی جدید', 'New chats'), value: totals.chatStarts },
          { label: t('نمایش شماره', 'Phone reveals'), value: totals.phoneReveals },
          { label: t('ذخیره', 'Saved'), value: totals.favorites },
        ].map((tile) => (
          <div key={tile.label} className="rounded-card border border-line bg-card p-3 text-center">
            <p className="text-2xl font-extrabold">{tile.value}</p>
            <p className="mt-1 text-xs font-bold text-muted">{tile.label}</p>
          </div>
        ))}
      </div>

      <nav aria-label={t('ترتیب آمار', 'Sort analytics')} className="flex flex-wrap gap-2">
        {OWNER_STATS_SORTS.map((key) => (
          <Link
            key={key}
            href={`/profile/stats?sort=${key}`}
            aria-current={sort === key ? 'page' : undefined}
            className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-bold transition ${
              sort === key
                ? 'border-cta bg-cta-soft text-ink'
                : 'border-line bg-card text-muted hover:border-line-strong'
            }`}
          >
            {t(OWNER_STATS_SORT_LABELS[key], sortEn[key] ?? OWNER_STATS_SORT_LABELS[key])}
          </Link>
        ))}
      </nav>

      {listings.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-12 text-center">
          <p className="font-extrabold">
            {t('هنوز آگهی‌ای ثبت نکرده‌اید.', 'You have not published any listings yet.')}
          </p>
          <Link href="/new" className="btn-cta mt-4 inline-flex text-sm">
            {t('ثبت آگهی', 'Post ad')}
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-card">
          <table className="w-full min-w-[560px] text-right text-sm">
            <thead className="border-b border-line text-xs text-muted">
              <tr>
                <th className="p-3 font-bold">{t('آگهی', 'Listing')}</th>
                <th className="p-3 font-bold">{t('بازدید', 'Views')}</th>
                <th className="p-3 font-bold">{t('گفتگوی جدید', 'New chats')}</th>
                <th className="p-3 font-bold">{t('نمایش شماره', 'Phone reveals')}</th>
                <th className="p-3 font-bold">{t('ذخیره', 'Saved')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const listing = listingById.get(row.listingId);
                return (
                  <tr key={row.listingId} className="border-b border-line last:border-0">
                    <td className="p-3">
                      <Link href={`/listing/${listing?.slug ?? ''}`} className="font-bold underline">
                        {listing
                          ? listing.part
                            ? listing.part.title
                            : `${listing.model} ${listing.year}`
                          : row.listingId}
                      </Link>
                      {listing && (
                        <span className="mt-0.5 block text-xs text-faint">
                          {formatPriceLatin(listing.priceIRR)}
                        </span>
                      )}
                    </td>
                    <td className="p-3">{row.views}</td>
                    <td className="p-3">{row.chatStarts}</td>
                    <td className="p-3">{row.phoneReveals}</td>
                    <td className="p-3">{row.favorites}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-faint">
        {t(
          '«بازدید» هر کاربر را یک بار می‌شمارد. «گفتگوی جدید» و «نمایش شماره» هرگز با هم جمع نمی‌شوند و هویت بازدیدکنندگان به مالک نمایش داده نمی‌شود.',
          '“Views” counts each visitor once. “New chats” and “Phone reveals” are never added together, and visitor identities are not shown to the owner.',
        )}
      </p>
    </div>
  );
}
