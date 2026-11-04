import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CITY_LABELS, formatJalaliDate, formatAmountLatin, irrToToman, postingAgeLabel } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { loadSellerProfile } from '@/lib/data/seller-profile';
import { brandLatinFor, vehicleTitle } from '@/lib/listing-text';
import { Icon } from '@/components/Icon';
import { SellerActions } from '@/components/SellerActions';
import { VerifiedPill } from '@/components/SellerVerified';
import { isPreSizedSource } from '@/lib/images';

export const metadata: Metadata = { title: 'پروفایل فروشنده' };

type Tab = 'active' | 'sold' | 'reviews';
const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
  { key: 'active', label: 'آگهی‌های فعال' },
  { key: 'sold', label: 'فروخته‌شده' },
  { key: 'reviews', label: 'نظرات' },
];

function parseTab(value: string | string[] | undefined): Tab {
  const v = Array.isArray(value) ? value[0] : value;
  return v === 'sold' || v === 'reviews' ? v : 'active';
}

function replyTime(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${minutes} دقیقه`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ساعت`;
  return `${Math.round(hours / 24)} روز`;
}

/**
 * Public seller profile — an Instagram-style identity page, not a settings page.
 *
 * Visitors and the owner see the same identity (cover, avatar, showroom name,
 * verification, city, member since, stats) and the same three tabs. The only
 * difference is the primary action: a visitor gets «پیام دادن», the owner gets
 * «ویرایش پروفایل».
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
  const profile = await loadSellerProfile(id);
  if (!profile) notFound();

  const session = await getSession();
  const isOwner = session?.sub === profile.id;
  const tab = parseTab(query.tab);
  const firstActive = profile.active[0] ?? null;
  const tabList = tab === 'active' ? profile.active : tab === 'sold' ? profile.sold : [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Cover + identity */}
      <section className="overflow-hidden rounded-card border border-line bg-card">
        <div
          aria-hidden
          className="h-28 w-full sm:h-36"
          style={{ background: 'linear-gradient(135deg, #F98513 0%, #ffb457 55%, #7c5a2e 100%)' }}
        />
        <div className="px-4 pb-4">
          <div className="-mt-9 flex items-end gap-3">
            <span
              aria-hidden
              className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border-4 border-[color:var(--color-surface)] bg-card text-2xl font-extrabold text-ink shadow"
            >
              {profile.initials}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <h1 className="flex flex-wrap items-center gap-1.5 text-lg font-extrabold leading-tight">
                <span className="truncate">{profile.name}</span>
                {profile.verified && <VerifiedPill label="تأییدشده" />}
              </h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-bold text-muted">
                <span className="inline-flex items-center gap-1">
                  <Icon name="pin" size={13} />
                  {CITY_LABELS[profile.city] ?? profile.city}
                </span>
                {profile.memberSince && (
                  <span>عضو از {formatJalaliDate(new Date(profile.memberSince))}</span>
                )}
              </p>
            </div>
          </div>

          <SellerActions
            sellerId={profile.id}
            listingId={firstActive?.id ?? null}
            name={profile.name}
            isOwner={isOwner}
            canCall={Boolean(firstActive?.allowPhoneReveal)}
          />

          {/* Stats row */}
          <dl className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {[
              { label: 'آگهی فعال', value: formatAmountLatin(profile.stats.active) },
              { label: 'فروخته‌شده', value: formatAmountLatin(profile.stats.sold) },
              {
                label: 'نرخ پاسخ',
                value:
                  profile.stats.responseRate === null ? '—' : `${profile.stats.responseRate}٪`,
              },
              { label: 'زمان پاسخ', value: replyTime(profile.stats.averageReplyMinutes) },
              {
                label: 'امتیاز',
                value: profile.stats.rating === null ? '—' : `${profile.stats.rating} / 5`,
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
      <nav aria-label="بخش‌های پروفایل" className="flex gap-1 rounded-card border border-line bg-card p-1">
        {TABS.map((item) => {
          const active = tab === item.key;
          const count =
            item.key === 'active'
              ? profile.active.length
              : item.key === 'sold'
                ? profile.sold.length
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
              {item.label}
              <span className="ms-1 text-[10px] text-faint">{count}</span>
            </Link>
          );
        })}
      </nav>

      {tab === 'reviews' ? (
        profile.reviews.length === 0 ? (
          <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-12 text-center">
            <Icon name="message" size={32} className="mx-auto text-faint" />
            <p className="mt-3 text-sm font-extrabold">هنوز نظری ثبت نشده است.</p>
            <p className="mt-1 text-xs text-muted">
              نظرات پس از تکمیل معامله توسط خریداران ثبت می‌شود.
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
                  {postingAgeLabel(review.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : tabList.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-12 text-center">
          <Icon name="tag" size={32} className="mx-auto text-faint" />
          <p className="mt-3 text-sm font-extrabold">
            {tab === 'active' ? 'آگهی فعالی ندارد.' : 'هنوز آگهی فروخته‌شده ندارد.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {tabList.map((listing) => {
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
                        className={`object-cover transition group-hover:scale-105 ${
                          listing.state === 'sold' ? 'opacity-70 grayscale' : ''
                        }`}
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
                    <p className="mt-0.5 truncate text-[11px] font-extrabold" style={{ color: '#F98513' }} dir="rtl">
                      {formatAmountLatin(irrToToman(listing.priceIRR))} تومان
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
