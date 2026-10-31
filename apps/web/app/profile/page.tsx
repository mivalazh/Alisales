import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ACCOUNT_TYPE_LABELS, maskPhone, totalOwnerStats } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { listingsBySeller, ownerStats } from '@/lib/data/s2-store';
import { Icon } from '@/components/Icon';
import { LogoutButton } from '@/components/LogoutButton';

export const metadata: Metadata = { title: 'پروفایل' };

/** Profile — account summary plus the owner-only statistics card (C2). */
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/profile');

  const [listings, stats] = await Promise.all([
    listingsBySeller(session.sub),
    ownerStats(session.sub),
  ]);
  const totals = totalOwnerStats(stats);
  const active = listings.filter((l) => l.state === 'active').length;

  const tiles = [
    { label: 'بازدید', value: totals.views },
    { label: 'گفتگوی جدید', value: totals.chatStarts },
    { label: 'نمایش شماره', value: totals.phoneReveals },
    { label: 'علاقه‌مندی', value: totals.favorites },
  ];

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-card p-4 sm:p-6">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cta-soft text-ink">
          <Icon name="user" size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold">{session.displayName}</h1>
          <p className="text-sm text-muted">
            {ACCOUNT_TYPE_LABELS[session.accountType]} ·{' '}
            <span dir="ltr">{maskPhone(session.phone)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/new" className="btn-cta text-sm">
            <Icon name="plus" size={18} />
            ثبت آگهی
          </Link>
        </div>
      </section>

      <section className="rounded-card border border-line bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-md font-extrabold">آمار آگهی‌های من</h2>
          <Link href="/profile/stats" className="text-xs font-bold text-muted underline">
            جزئیات هر آگهی
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-field border border-line bg-page p-3 text-center">
              <p className="text-2xl font-extrabold">{tile.value}</p>
              <p className="mt-1 text-xs font-bold text-muted">{tile.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-faint">
          این اعداد فقط برای شما نمایش داده می‌شوند؛ «گفتگوی جدید» و «نمایش شماره» دو شمارنده‌ی
          جداگانه‌اند.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/profile/listings"
          className="flex items-center justify-between rounded-card border border-line bg-card p-4 font-bold transition hover:border-line-strong"
        >
          <span>آگهی‌های من</span>
          <span className="text-sm text-muted">{active} فعال</span>
        </Link>
        <Link
          href="/profile/settings"
          className="flex items-center justify-between rounded-card border border-line bg-card p-4 font-bold transition hover:border-line-strong"
        >
          <span>تنظیمات حساب</span>
          <Icon name="gear" size={18} className="text-faint" />
        </Link>
      </section>

      <section className="rounded-card border border-line bg-card p-4">
        <LogoutButton />
      </section>
    </div>
  );
}
