import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ACCOUNT_TYPE_LABELS, formatAmountLatin, maskPhone } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { showAdminLink } from '@/lib/admin/guard';
import {
  conversationsForUser,
  getUser,
  listFavoriteIds,
  listingsBySeller,
} from '@/lib/data/s2-store';
import { averageRating, reviewsFor } from '@/lib/data/reviews';
import { followedSellerIds, profileCustomization } from '@/lib/data/social-store';
import { storiesFrom } from '@/lib/stories';
import { Icon, type IconName } from '@/components/Icon';
import { LogoutButton } from '@/components/LogoutButton';
import { ProfileCustomizer } from '@/components/ProfileCustomizer';

export const metadata: Metadata = { title: 'پروفایل' };

/**
 * Profile — identity at the top, then the four things a member actually uses:
 * live listings, saved ads, rating & reviews, and stories. Followed showrooms
 * get their own strip, because the follow is the reason their stock and stories
 * are pushed to the front of the feeds.
 */
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/profile');

  const [listings, favoriteIds, conversations, admin, reviews, custom] = await Promise.all([
    listingsBySeller(session.sub),
    listFavoriteIds(session.sub),
    conversationsForUser(session.sub),
    showAdminLink(),
    reviewsFor(session.sub),
    Promise.resolve(profileCustomization(session.sub)),
  ]);
  const active = listings.filter((listing) => listing.state === 'active');
  const rating = averageRating(reviews);
  const stories = storiesFrom(active, [], [], 8);
  const initial = (session.displayName ?? '?').trim().charAt(0) || '?';

  const followedIds = followedSellerIds(session.sub);
  const followed = await Promise.all(
    followedIds.slice(0, 12).map(async (id) => {
      const account = await getUser(id);
      return { id, name: account?.displayName?.trim() || 'نمایشگاه' };
    }),
  );

  const shortcuts: ReadonlyArray<{
    href: string;
    label: string;
    hint: string;
    icon: IconName;
  }> = [
    {
      href: '/profile/listings',
      label: 'آگهی‌های فعال',
      hint: `${active.length} فعال از ${listings.length}`,
      icon: 'tag',
    },
    {
      href: '/favorites',
      label: 'ذخیره‌شده‌ها',
      hint: `${favoriteIds.length} آگهی ذخیره‌شده`,
      icon: 'heart',
    },
    {
      href: `/seller/${session.sub}?tab=reviews`,
      label: 'امتیاز و نظرات',
      hint: rating === null ? 'هنوز امتیازی ثبت نشده' : `${rating} از ۵ · ${reviews.length} نظر`,
      icon: 'badgeCheck',
    },
    {
      href: `/seller/${session.sub}?tab=stories`,
      label: 'استوری‌ها',
      hint: `${stories.length} استوری از آگهی‌های شما`,
      icon: 'camera',
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
      hint: 'نام نمایشی، رمز عبور و شماره تماس',
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
      <section className="rounded-card border border-line bg-card p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-cta-soft text-xl font-extrabold text-ink"
          >
            {custom?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={custom.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
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
            href={`/seller/${session.sub}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-muted transition hover:border-line-strong hover:text-ink"
            aria-label="نمایش پروفایل عمومی"
            title="پروفایل عمومی"
          >
            <Icon name="user" size={18} />
          </Link>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'آگهی فعال', value: formatAmountLatin(active.length) },
            { label: 'ذخیره‌شده', value: formatAmountLatin(favoriteIds.length) },
            {
              label: 'امتیاز',
              value: rating === null ? '—' : `${rating} / 5`,
            },
            { label: 'استوری', value: formatAmountLatin(stories.length) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-field border border-line bg-page px-2 py-2 text-center"
            >
              <dt className="text-[10px] font-bold text-muted">{stat.label}</dt>
              <dd className="mt-0.5 text-sm font-extrabold text-ink">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ProfileCustomizer
        initial={{
          bio: custom?.bio ?? '',
          avatarUrl: custom?.avatarUrl ?? null,
          coverUrl: custom?.coverUrl ?? null,
        }}
        displayName={session.displayName ?? ''}
        initials={initial}
      />

      {followed.length > 0 && (
        <section aria-label="نمایشگاه‌های دنبال‌شده" className="rounded-card border border-line bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold">نمایشگاه‌های دنبال‌شده</h2>
            <span className="text-[11px] font-bold text-faint">{followedIds.length}</span>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {followed.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/seller/${item.id}`}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-cta bg-cta-soft px-3 py-1.5 text-xs font-extrabold text-ink"
                >
                  <Icon name="shieldCheck" size={13} />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            آگهی‌ها و استوری‌های این نمایشگاه‌ها در ابتدای فیدها و ریل استوری نمایش داده می‌شود.
          </p>
        </section>
      )}

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
