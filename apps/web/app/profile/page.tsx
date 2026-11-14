import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  BUSINESS_TYPE_LABELS,
  formatAmountLatin,
  maskPhone,
  profileModeFor,
} from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { getUser, listFavoriteIds, listingsBySeller } from '@/lib/data/s2-store';
import { averageRating, reviewsFor } from '@/lib/data/reviews';
import { followedSellerIds, profileCustomization } from '@/lib/data/social-store';
import { storiesFrom } from '@/lib/stories';
import { Icon, type IconName } from '@/components/Icon';
import { LogoutButton } from '@/components/LogoutButton';
import { ProfileCustomizer } from '@/components/ProfileCustomizer';
import { ProfileMediaButton } from '@/components/ProfileMediaButton';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'پروفایل' },
  { title: 'Profile' },
);

type Shortcut = {
  href: string;
  label: string;
  hint: string;
  icon: IconName;
};

/**
 * Profile — a private personal hub or a public-facing business storefront.
 *
 * Personal accounts keep only listings, saved ads, stories, settings and
 * logout. Business accounts additionally expose their public page, inventory
 * count, stories, followers and rating.
 */
export default async function ProfilePage() {
  const [session, lang] = await Promise.all([getSession(), getLanguage()]);
  if (!session) redirect('/login?next=/profile');
  const t = (fa: string, en?: string) => serverT(lang, fa, en);

  const [listings, favoriteIds, reviews, custom, account] = await Promise.all([
    listingsBySeller(session.sub),
    listFavoriteIds(session.sub),
    reviewsFor(session.sub),
    Promise.resolve(profileCustomization(session.sub)),
    getUser(session.sub),
  ]);
  const profileMode = custom?.profileMode ?? profileModeFor(account?.accountType ?? session.accountType);
  const isBusiness = profileMode === 'business';
  const active = listings.filter((listing) => listing.state === 'active');
  const rating = averageRating(reviews);
  const stories = storiesFrom(active, [], [], 8);
  const initial = (session.displayName ?? '?').trim().charAt(0) || '?';

  const followedIds = isBusiness ? followedSellerIds(session.sub) : [];
  const followed = await Promise.all(
    followedIds.slice(0, 12).map(async (id) => {
      const followedAccount = await getUser(id);
      return { id, name: followedAccount?.displayName?.trim() || t('کسب‌وکار', 'Business') };
    }),
  );

  const baseShortcuts: Shortcut[] = [
    {
      href: '/profile/listings',
      label: t('آگهی‌های من'),
      hint: t(`${listings.length} آگهی · ${active.length} فعال`),
      icon: 'tag',
    },
    {
      href: '/favorites',
      label: t('ذخیره‌شده‌ها'),
      hint: t(`${favoriteIds.length} آگهی ذخیره‌شده`),
      icon: 'bookmark',
    },
    {
      href: `/seller/${session.sub}?tab=stories`,
      label: t('استوری‌های من'),
      hint: t(`${stories.length} استوری از آگهی‌های شما`),
      icon: 'camera',
    },
    {
      href: '/profile/settings',
      label: t('تنظیمات حساب'),
      hint: t('نوع حساب، نام نمایشی و رمز عبور'),
      icon: 'gear',
    },
  ];

  const shortcuts: Shortcut[] = isBusiness
    ? [
        {
          href: `/seller/${session.sub}`,
          label: t('مشاهده صفحه عمومی'),
          hint: t('کاور، بایو، آگهی‌ها، استوری و امتیاز'),
          icon: 'badgeCheck',
        },
        ...baseShortcuts.slice(0, 3),
        {
          href: `/seller/${session.sub}?tab=reviews`,
          label: t('امتیاز و نظرات'),
          hint:
            rating === null
              ? t('هنوز امتیازی ثبت نشده')
              : t(`${rating} از ۵ · ${reviews.length} نظر`),
          icon: 'sparkle',
        },
        ...baseShortcuts.slice(3),
      ]
    : baseShortcuts;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="overflow-hidden rounded-3xl border border-line bg-card shadow-sm">
        <div className="relative h-32 bg-gradient-to-br from-[#111144] via-[#0F7FC4] to-[#57c7a3] sm:h-40">
          {custom?.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={custom.coverUrl}
              alt={t('کاور پروفایل')}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,#DEF434_0,transparent_35%),radial-gradient(circle_at_80%_60%,#ffffff_0,transparent_30%)]" />
          )}
          <ProfileMediaButton kind="cover" label={t('تغییر کاور پروفایل')} />
        </div>
        <div className="px-4 pb-4 sm:px-5">
          <div className="flex items-end gap-3">
            <div className="relative -mt-9 shrink-0 sm:-mt-11">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-cta-soft text-2xl font-extrabold text-ink shadow-lg sm:h-24 sm:w-24">
                {custom?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={custom.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  initial
                )}
              </div>
              <ProfileMediaButton kind="avatar" label={t('تغییر عکس پروفایل')} />
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="truncate text-lg font-extrabold sm:text-xl">{session.displayName}</h1>
              <p className="mt-0.5 text-xs text-muted sm:text-sm">
                <span dir="ltr">{maskPhone(session.phone)}</span>
                <span className="mx-1.5 text-faint">·</span>
                {isBusiness ? t('حساب کسب‌وکار') : t('حساب شخصی')}
                {isBusiness && custom?.businessType && (
                  <>
                    <span className="mx-1.5 text-faint">·</span>
                    {t(BUSINESS_TYPE_LABELS[custom.businessType])}
                  </>
                )}
              </p>
            </div>
          </div>

          {custom?.bio?.trim() ? (
            <p className="mt-3 whitespace-pre-line text-xs leading-6 text-muted sm:text-sm">
              {custom.bio}
            </p>
          ) : null}

          <ProfileCustomizer
            embedded
            initial={{
              bio: custom?.bio ?? '',
              avatarUrl: custom?.avatarUrl ?? null,
            }}
          />
        </div>

        {isBusiness && (
          <dl className="grid grid-cols-2 gap-2 border-t border-line bg-page/60 p-3 sm:grid-cols-4 sm:p-4">
            {[
              {
                label: t('آگهی‌های فعال'),
                value: formatAmountLatin(active.length),
                href: '/profile/listings',
                tone: 'text-[#0F7FC4]',
              },
              {
                label: t('ذخیره‌شده‌ها'),
                value: formatAmountLatin(favoriteIds.length),
                href: '/favorites',
                tone: 'text-[#F98513]',
              },
              {
                label: t('استوری‌ها'),
                value: formatAmountLatin(stories.length),
                href: `/seller/${session.sub}?tab=stories`,
                tone: 'text-amber-500',
              },
              {
                label: t('دنبال‌کننده‌ها'),
                value: formatAmountLatin(followedIds.length),
                href: '#followed-businesses',
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
              </Link>
            ))}
          </dl>
        )}
      </section>

      {isBusiness && followed.length > 0 && (
        <section
          id="followed-businesses"
          aria-label={t('کسب‌وکارهای دنبال‌شده')}
          className="scroll-mt-24 rounded-card border border-line bg-card p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold">{t('کسب‌وکارهای دنبال‌شده')}</h2>
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
        </section>
      )}

      <section aria-label={t('دسترسی سریع')} className="grid gap-2 sm:grid-cols-2">
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
        <LogoutButton />
      </section>
    </div>
  );
}
