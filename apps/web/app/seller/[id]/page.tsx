import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CITY_LABELS, formatJalaliDate, formatAmountLatin, irrToToman, postingAgeLabel } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { loadSellerProfile } from '@/lib/data/seller-profile';
import { isFollowing } from '@/lib/data/social-store';
import { brandLatinFor, vehicleTitle } from '@/lib/listing-text';
import { Icon } from '@/components/Icon';
import { FollowSellerButton } from '@/components/FollowSellerButton';
import { SellerActions } from '@/components/SellerActions';
import { Stories } from '@/components/Stories';
import { VerifiedPill } from '@/components/SellerVerified';
import { NativeBackHeader } from '@/components/NativeBackHeader';
import { isPreSizedSource } from '@/lib/images';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';
import { postingAgeEnglish } from '@/lib/i18n/dictionary';
import { translateListingContentToEn } from '@/lib/i18n/content';
import { isPublicSellerProfile } from '@/lib/seller-visibility';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [{ id }, lang] = await Promise.all([params, getLanguage()]);
  const profile = await loadSellerProfile(id);
  const title = lang === 'en' ? 'Seller profile' : 'پروفایل فروشنده';
  if (!profile || !isPublicSellerProfile(profile.profileMode)) {
    return { title, robots: { index: false, follow: false } };
  }
  return {
    title,
    alternates: { canonical: `/seller/${profile.id}` },
  };
}

type Tab = 'active' | 'stories' | 'reviews';
const TABS: ReadonlyArray<{ key: Tab; label: string; en: string }> = [
  { key: 'active', label: 'آگهی‌های فعال', en: 'Active listings' },
  { key: 'stories', label: 'استوری‌ها', en: 'Stories' },
  { key: 'reviews', label: 'امتیاز و نظرات', en: 'Rating & reviews' },
];

function parseTab(value: string | string[] | undefined): Tab {
  const v = Array.isArray(value) ? value[0] : value;
  return v === 'stories' || v === 'reviews' ? v : 'active';
}

/**
 * Public business profile — an Instagram-style identity page.
 *
 * Personal accounts never reach this route: owners are redirected to /profile
 * and visitors get a 404. For a business, four numbers only: live listings,
 * stories, rating and followers. Sold counts, response rate and reply time are
 * deliberately absent; they were noise on a page whose job is «who is this
 * showroom and what do they have».
 */
export default async function SellerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [profile, lang] = await Promise.all([loadSellerProfile(id), getLanguage()]);
  if (!profile) notFound();

  const session = await getSession();
  // Personal accounts have no public seller page. Owners go back to their
  // private hub; everyone else gets a 404 rather than a hint that it exists.
  if (!isPublicSellerProfile(profile.profileMode)) {
    if (session?.sub === profile.id) redirect('/profile');
    notFound();
  }

  const t = (fa: string, en?: string) => serverT(lang, fa, en);

  const displayName =
    lang === 'en' ? translateListingContentToEn(profile.name) : profile.name;
  const displayBio =
    profile.bio && lang === 'en'
      ? translateListingContentToEn(profile.bio)
      : profile.bio;

  const isOwner = session?.sub === profile.id;
  const tab = parseTab(query.tab);
  const firstActive = profile.active[0] ?? null;
  const following = await isFollowing(session?.sub, profile.id);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <NativeBackHeader title={displayName} fallbackHref="/" />
      {/* Cover + identity */}
      <section className="overflow-hidden rounded-card border border-line bg-card">
        <div
          aria-hidden
          className="relative h-28 w-full overflow-hidden sm:h-36"
          style={{ background: 'linear-gradient(135deg, #F98513 0%, #ffb457 55%, #7c5a2e 100%)' }}
        >
          {profile.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>
        <div className="px-4 pb-4">
          <div className="-mt-9 flex items-end gap-3">
            <span
              aria-hidden
              className="flex h-[76px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-[color:var(--color-surface)] bg-card text-2xl font-extrabold text-ink shadow"
            >
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                profile.initials
              )}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="flex flex-wrap items-center gap-1.5 text-lg font-extrabold leading-tight">
                <span className="truncate">{displayName}</span>
                {profile.verified && <VerifiedPill label={t('تأییدشده', 'Verified')} />}
              </h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-bold text-muted">
                <span className="inline-flex items-center gap-1">
                  <Icon name="pin" size={13} />
                  {CITY_LABELS[profile.city] ?? profile.city}
                </span>
                {profile.memberSince && (
                  <span>
                    {t('عضو از', 'Member since')}{' '}
                    {lang === 'en'
                      ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(
                          new Date(profile.memberSince),
                        )
                      : formatJalaliDate(new Date(profile.memberSince))}
                  </span>
                )}
              </p>
            </div>
          </div>

          {displayBio && (
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink/85">{displayBio}</p>
          )}

          <div className="mt-3 flex flex-wrap items-start gap-2">
            {!isOwner && (
              <FollowSellerButton
                sellerId={profile.id}
                initialFollowing={following}
                authed={Boolean(session)}
                isOwner={isOwner}
              />
            )}
            <SellerActions
              sellerId={profile.id}
              listingId={firstActive?.id ?? null}
              name={displayName}
              isOwner={isOwner}
              canCall={Boolean(firstActive?.allowPhoneReveal)}
            />
          </div>

          {/* Four numbers, nothing else. */}
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                label: t('آگهی‌های فعال', 'Active listings'),
                value: formatAmountLatin(profile.stats.active),
              },
              { label: t('استوری‌ها', 'Stories'), value: formatAmountLatin(profile.stats.stories) },
              {
                label: t('امتیاز و نظرات', 'Rating & reviews'),
                value:
                  profile.stats.rating === null
                    ? '—'
                    : `${profile.stats.rating} / 5 (${profile.stats.reviewCount})`,
              },
              {
                label: t('دنبال‌کننده', 'Followers'),
                value: formatAmountLatin(profile.stats.followers),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-field border border-line bg-page px-2 py-2 text-center"
              >
                <dt className="text-[10px] font-bold text-muted">{stat.label}</dt>
                <dd className="mt-0.5 text-sm font-extrabold text-ink" dir="auto">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Tabs */}
      <nav aria-label={t('بخش‌های پروفایل', 'Profile sections')} className="flex gap-1 rounded-card border border-line bg-card p-1">
        {TABS.map((item) => {
          const active = tab === item.key;
          const count =
            item.key === 'active'
              ? profile.active.length
              : item.key === 'stories'
                ? profile.stories.length
                : profile.reviews.length;
          return (
            <Link
              key={item.key}
              href={`/seller/${profile.id}?tab=${item.key}`}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 rounded-field px-2 py-2 text-center text-xs font-extrabold transition sm:text-sm ${
                active ? 'bg-cta-soft text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {t(item.label, item.en)}
              <span className="ms-1 text-[10px] text-faint">{count}</span>
            </Link>
          );
        })}
      </nav>

      {tab === 'stories' ? (
        profile.stories.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-12 text-center">
            <Icon name="camera" size={32} className="mx-auto text-faint" />
            <p className="mt-3 text-sm font-extrabold">
              {t('هنوز استوری‌ای برای این نمایشگاه نیست.', 'No stories from this showroom yet.')}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t(
                'استوری‌ها از آگهی‌های فعال عکس‌دار ساخته می‌شوند.',
                'Stories are created from active listings with photos.',
              )}
            </p>
          </div>
        ) : (
          <Stories
            stories={profile.stories}
            label={t('استوری‌های این نمایشگاه', 'This showroom’s stories')}
          />
        )
      ) : tab === 'reviews' ? (
        profile.reviews.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-12 text-center">
            <Icon name="message" size={32} className="mx-auto text-faint" />
            <p className="mt-3 text-sm font-extrabold">
              {t('هنوز نظری ثبت نشده است.', 'No reviews yet.')}
            </p>
            <p className="mt-1 text-xs text-muted">
              {t(
                'نظرات پس از تکمیل معامله توسط خریداران ثبت می‌شود.',
                'Reviews are added by buyers after a completed transaction.',
              )}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {profile.reviews.map((review) => (
              <li key={review.id} className="rounded-card border border-line bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold">{review.authorName}</p>
                  <p className="text-xs font-extrabold" style={{ color: '#F98513' }} dir="ltr">
                    {'★'.repeat(review.rating)}
                    <span className="text-faint">{'★'.repeat(5 - review.rating)}</span>
                  </p>
                </div>
                <p className="mt-2 text-sm leading-7 text-ink/85">{review.body}</p>
                <p className="mt-2 text-[11px] font-bold text-faint">
                  {review.listingTitle ? `${review.listingTitle} · ` : ''}
                  {lang === 'en'
                    ? postingAgeEnglish(review.createdAt)
                    : postingAgeLabel(review.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : profile.active.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-12 text-center">
          <Icon name="tag" size={32} className="mx-auto text-faint" />
          <p className="mt-3 text-sm font-extrabold">
            {t('آگهی فعالی ندارد.', 'No active listings.')}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {profile.active.map((listing) => {
            const title = listing.part ? listing.part.title : vehicleTitle(listing);
            const latin = listing.part ? null : brandLatinFor(listing.brand);
            return (
              <li key={listing.id}>
                <Link
                  href={`/listing/${listing.slug}`}
                  className="group block overflow-hidden rounded-field border border-line bg-card"
                >
                  <div className="relative aspect-square bg-sunken">
                    {listing.coverUrl ? (
                      <Image
                        src={listing.coverUrl}
                        alt={title}
                        fill
                        sizes="(min-width: 640px) 30vw, 33vw"
                        unoptimized={isPreSizedSource(listing.coverUrl)}
                        loading="lazy"
                        decoding="async"
                        className="object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-faint">
                        <Icon name="camera" size={22} />
                      </span>
                    )}
                  </div>
                  <div className="p-1.5">
                    {latin && (
                      <p
                        dir="ltr"
                        className="truncate text-start text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted"
                      >
                        {latin}
                      </p>
                    )}
                    <p className="truncate text-[11px] font-extrabold text-ink">{title}</p>
                    <p
                      className="mt-0.5 truncate text-[11px] font-extrabold"
                      style={{ color: '#F98513' }}
                      dir="rtl"
                    >
                      {formatAmountLatin(irrToToman(listing.priceIRR))}{' '}
                      {t('تومان', 'Toman')}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
