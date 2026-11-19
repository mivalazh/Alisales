import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CITY_LABELS, formatAmountLatin, irrToToman, postingAgeLabel } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { loadSellerProfile } from '@/lib/data/seller-profile';
import { isFollowing } from '@/lib/data/social-store';
import { brandLatinFor, vehicleTitle } from '@/lib/listing-text';
import { Icon } from '@/components/Icon';
import { FollowSellerButton } from '@/components/FollowSellerButton';
import { SellerActions } from '@/components/SellerActions';
import { Stories } from '@/components/Stories';
import { VerifiedStar } from '@/components/SellerVerified';
import { NativeBackHeader } from '@/components/NativeBackHeader';
import { isPreSizedSource } from '@/lib/images';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';
import { postingAgeEnglish } from '@/lib/i18n/dictionary';
import { translateListingContentToEn } from '@/lib/i18n/content';
import { coverForSeller } from '@/lib/data/profile-cover';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const [{ id }, lang] = await Promise.all([params, getLanguage()]);
  const profile = await loadSellerProfile(id);
  const title = lang === 'en' ? 'Seller profile' : 'پروفایل فروشنده';
  if (!profile) {
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
  // Every seller — verified showroom or regular private seller — has a public
  // profile. The owner can open it too (their /profile page links here).

  const t = (fa: string, en?: string) => serverT(lang, fa, en);

  const displayName =
    lang === 'en' ? translateListingContentToEn(profile.name) : profile.name;
  const displayBio =
    profile.bio && lang === 'en'
      ? translateListingContentToEn(profile.bio)
      : profile.bio;

  const isOwner = session?.sub === profile.id;
  const tab = parseTab(query.tab);
  const following = await isFollowing(session?.sub, profile.id);

  return (
    <div className="mx-auto mt-3 max-w-4xl space-y-4 sm:mt-4">
      <NativeBackHeader title={displayName} fallbackHref="/" />
      {/* Cover + identity */}
      <section className="overflow-hidden rounded-card border border-line bg-card">
        {/* Stable vehicle photograph chosen from the profile id — never a
            flat orange banner. */}
        <div aria-hidden className="relative h-32 w-full overflow-hidden bg-sunken sm:h-44">
          <Image
            src={profile.coverUrl ?? coverForSeller(profile.id)}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        </div>
        <div className="px-4 pb-4">
          {/* Only the avatar breaks the cover edge. The name, seal and city sit
              on the solid card surface so nothing is ever printed on the photo. */}
          <span
            aria-hidden
            className="relative z-10 -mt-10 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card text-2xl font-extrabold text-ink shadow ring-4 ring-white dark:ring-[#161A38]"
          >
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" width={512} height={512} className="h-full w-full object-cover" />
            ) : (
              profile.initials
            )}
          </span>
          <div className="pt-2">
            <h1 className="flex min-w-0 items-center gap-1.5 text-lg font-extrabold leading-tight">
              <span className="truncate">{displayName}</span>
              {profile.verified && <VerifiedStar label={t('تأییدشده توسط آلی سیلز', 'Verified by Ali Sales')} />}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs font-bold text-muted">
              <span className="inline-flex items-center gap-1">
                <Icon name="pin" size={13} />
                {CITY_LABELS[profile.city] ?? profile.city}
              </span>
            </p>
          </div>

          {displayBio && (
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink/85">{displayBio}</p>
          )}

          {/* Profile actions sit beside the follow control: share/edit on the
              start edge, follow on the end edge. Messaging and calling stay on
              the listings themselves. */}
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
            <SellerActions
              sellerId={profile.id}
              name={displayName}
              isOwner={isOwner}
            />
            {!isOwner && (
              <FollowSellerButton
                sellerId={profile.id}
                initialFollowing={following}
                authed={Boolean(session)}
                isOwner={isOwner}
              />
            )}
          </div>

          {/* Three numbers — active listings, stories, rating. No follower
              count is shown to anyone. */}
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {[
              {
                label: t('آگهی‌های فعال', 'Active listings'),
                value: formatAmountLatin(profile.stats.active),
                tone: 'text-[#F98513]',
              },
              {
                label: t('استوری‌ها', 'Stories'),
                value: formatAmountLatin(profile.stats.stories),
                tone: 'text-[#0F7FC4]',
              },
              {
                label: t('امتیاز و نظرات', 'Rating & reviews'),
                value:
                  profile.stats.rating === null
                    ? '—'
                    : `${profile.stats.rating} / 5 (${profile.stats.reviewCount})`,
                tone: 'text-emerald-500',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-field border border-line bg-page px-2 py-2 text-center"
              >
                <dt className="text-[10px] font-bold text-muted">{stat.label}</dt>
                <dd
                  className={`mt-0.5 text-sm font-extrabold tabular-nums ${stat.tone}`}
                  dir="auto"
                >
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>

        </div>
      </section>

      {/* Tabs */}
      <nav
        aria-label={t('بخش‌های پروفایل', 'Profile sections')}
        className="flex gap-4 border-b border-line px-1"
      >
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
              className={`-mb-px flex min-h-11 flex-1 items-center justify-center gap-1 border-b-2 px-1 py-2 text-center text-xs font-extrabold transition sm:text-sm ${
                active
                  ? 'border-cta text-ink'
                  : 'border-transparent text-muted hover:text-ink'
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
                  <p className="text-xs font-extrabold" style={{ color: 'var(--price-ink, #B45309)' }} dir="ltr">
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
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                      style={{ color: 'var(--price-ink, #B45309)' }}
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
