import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ACCOUNT_TYPE_LABELS, formatAmountLatin, maskPhone } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
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

  const [listings, favoriteIds, conversations, reviews, custom] = await Promise.all([
    listingsBySeller(session.sub),
    listFavoriteIds(session.sub),
    conversationsForUser(session.sub),
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
      href: '/inspection',
      label: 'کارشناسی تعمیرگاه شمس‌اله',
      hint: 'رزرو نوبت با ۲۰٪ تخفیف ویژه کاربران سایت',
      icon: 'shieldCheck',
    },
    {
      href: '/rent',
      label: 'رنت خودرو و موتور',
      hint: 'اجاره خودرو و اسکوتر برقی در کیش',
      icon: 'plate',
    },
    {
      href: '/profile/settings',
      label: 'تنظیمات حساب',
      hint: 'نام نمایشی، رمز عبور و شماره تماس',
      icon: 'gear',
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="overflow-hidden rounded-3xl border border-line bg-card shadow-sm">
        {/* Interactive hero: cover, overlapping avatar with a camera badge to the
            editor, then the bio and the account line. */}
        <div className="relative h-32 bg-gradient-to-br from-[#111144] via-[#0F7FC4] to-[#57c7a3] sm:h-40">
          {custom?.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={custom.coverUrl} alt="کاور پروفایل" className="h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,#DEF434_0,transparent_35%),radial-gradient(circle_at_80%_60%,#ffffff_0,transparent_30%)]" />
          )}
        </div>
        <div className="px-4 pb-4 sm:px-5">
          <div className="flex items-end gap-3">
            <a
              href="#profile-editor"
              aria-label="ویرایش عکس پروفایل"
              className="group relative -mt-9 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-cta-soft text-2xl font-extrabold text-ink shadow-lg sm:-mt-11 sm:h-24 sm:w-24"
            >
              {custom?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={custom.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
              <span className="absolute bottom-0 end-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-[#0F7FC4] text-white transition group-hover:scale-110">
                <Icon name="camera" size={13} />
              </span>
            </a>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="truncate text-lg font-extrabold sm:text-xl">{session.displayName}</h1>
              <p className="mt-0.5 text-xs text-muted sm:text-sm">
                <span dir="ltr">{maskPhone(session.phone)}</span>
                <span className="mx-1.5 text-faint">·</span>
                {ACCOUNT_TYPE_LABELS[session.accountType]}
              </p>
            </div>
            <a
              href="#profile-editor"
              className="mb-1 hidden rounded-full border border-line px-3 py-1.5 text-[11px] font-extrabold text-ink transition hover:border-line-strong sm:inline-flex"
            >
              ویرایش پروفایل
            </a>
          </div>

          <p className="mt-3 line-clamp-3 text-xs leading-6 text-muted sm:text-sm">
            {custom?.bio?.trim() ||
              'بایو خود را اضافه کنید: چه خودروهایی می‌فروشید، کجای کیش هستید و چه چیزی شما را متفاوت می‌کند.'}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-2 border-t border-line bg-page/60 p-3 sm:grid-cols-4 sm:p-4">
          {[
            {
              label: 'آگهی‌های فعال',
              value: formatAmountLatin(active.length),
              href: '/profile/listings',
              tone: 'text-[#0F7FC4]',
            },
            {
              label: 'ذخیره‌شده‌ها',
              value: formatAmountLatin(favoriteIds.length),
              href: '/favorites',
              tone: 'text-rose-500',
            },
            {
              label: 'استوری‌های من',
              value: formatAmountLatin(stories.length),
              href: `/seller/${session.sub}?tab=stories`,
              tone: 'text-amber-500',
            },
            {
              label: 'نمایشگاه‌های دنبال‌شده',
              value: formatAmountLatin(followedIds.length),
              href: '#followed-showrooms',
              tone: 'text-emerald-600',
            },
          ].map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-2xl border border-line bg-card px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm"
            >
              <dt className="text-[10px] font-bold text-muted">{stat.label}</dt>
              <dd className={`mt-1 text-lg font-extrabold ${stat.tone}`}>{stat.value}</dd>
              {stat.label === 'نمایشگاه‌های دنبال‌شده' && rating !== null && (
                <dd className="mt-0.5 text-[9px] font-bold text-faint">امتیاز شما {rating} از ۵</dd>
              )}
            </Link>
          ))}
        </dl>
      </section>

      <div id="profile-editor" className="scroll-mt-24">
        <ProfileCustomizer
          initial={{
          bio: custom?.bio ?? '',
          avatarUrl: custom?.avatarUrl ?? null,
          coverUrl: custom?.coverUrl ?? null,
        }}
          displayName={session.displayName ?? ''}
          initials={initial}
        />
      </div>

      {followed.length > 0 && (
        <section
          id="followed-showrooms"
          aria-label="نمایشگاه‌های دنبال‌شده"
          className="scroll-mt-24 rounded-card border border-line bg-card p-4"
        >
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
