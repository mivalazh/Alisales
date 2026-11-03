import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ACCOUNT_TYPE_LABELS, maskPhone } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { showAdminLink } from '@/lib/admin/guard';
import { conversationsForUser, listFavoriteIds, listingsBySeller } from '@/lib/data/s2-store';
import { Icon, type IconName } from '@/components/Icon';
import { LogoutButton } from '@/components/LogoutButton';

export const metadata: Metadata = { title: 'پروفایل' };

/**
 * Profile — deliberately plain: who you are at the top, then the four places a
 * signed-in buyer actually goes, then account settings and sign-out. The owner
 * statistics live on their own page instead of crowding the entry screen.
 */
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/profile');

  const [listings, favoriteIds, conversations, admin] = await Promise.all([
    listingsBySeller(session.sub),
    listFavoriteIds(session.sub),
    conversationsForUser(session.sub),
    showAdminLink(),
  ]);
  const active = listings.filter((listing) => listing.state === 'active').length;
  const initial = (session.displayName ?? '?').trim().charAt(0) || '?';

  const shortcuts: ReadonlyArray<{
    href: string;
    label: string;
    hint: string;
    icon: IconName;
  }> = [
    {
      href: '/profile/listings',
      label: 'آگهی‌های من',
      hint: `${active} فعال از ${listings.length}`,
      icon: 'tag',
    },
    {
      href: '/favorites',
      label: 'علاقه‌مندی‌ها',
      hint: `${favoriteIds.length} آگهی ذخیره‌شده`,
      icon: 'heart',
    },
    {
      href: '/chats',
      label: 'پیام‌ها',
      hint: `${conversations.length} گفتگو`,
      icon: 'message',
    },
    {
      href: '/profile/settings',
      label: 'تنظیمات حساب',
      hint: 'نام نمایشی و شماره تماس',
      icon: 'gear',
    },
    ...(admin
      ? [
          {
            href: '/admin',
            label: 'پنل مدیریت',
            hint: 'گزارش‌ها، احراز و داستان‌ها',
            icon: 'gear' as IconName,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="flex items-center gap-4 rounded-card border border-line bg-card p-4 sm:p-5">
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cta-soft text-xl font-extrabold text-ink"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold">{session.displayName}</h1>
          <p className="mt-0.5 text-sm text-muted">
            <span dir="ltr">{maskPhone(session.phone)}</span>
            <span className="mx-1.5 text-faint">·</span>
            {ACCOUNT_TYPE_LABELS[session.accountType]}
          </p>
        </div>
        <Link
          href="/profile/stats"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:border-line-strong hover:text-ink"
          aria-label="آمار آگهی‌ها"
          title="آمار آگهی‌ها"
        >
          <Icon name="mileage" size={18} />
        </Link>
      </section>

      <section aria-label="دسترسی سریع" className="grid gap-2 sm:grid-cols-2">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex items-center gap-3 rounded-card border border-line bg-card p-4 transition hover:border-line-strong"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-page text-ink">
              <Icon name={item.icon} size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-ink">{item.label}</span>
              <span className="mt-0.5 block truncate text-xs text-muted">{item.hint}</span>
            </span>
            <Icon
              name="chevronLeft"
              size={16}
              className="shrink-0 text-faint transition group-hover:text-ink"
            />
          </Link>
        ))}
      </section>

      <section className="rounded-card border border-line bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold">حساب</h2>
          <Link href="/guide" className="text-xs font-bold text-muted underline">
            راهنمای ثبت آگهی
          </Link>
        </div>
        <div className="mt-3">
          <LogoutButton />
        </div>
      </section>
    </div>
  );
}
