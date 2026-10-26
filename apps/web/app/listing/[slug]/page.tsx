import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { badgeFor, type BadgeKey } from '@studio/design';
import {
  CITY_LABELS,
  COLOR_LABELS,
  CONDITION_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
  PLATE_TYPE_LABELS,
  formatIRR,
  formatJalaliDate,
  groupDigits,
  toPersianDigits,
} from '@alisales/schemas';
import { ContactButtons } from '@/components/ContactButtons';
import { FavoriteButton } from '@/components/FavoriteButton';
import { Icon } from '@/components/Icon';
import { getListing, getSellerPhone } from '@/lib/data/listings';

const STATE_BADGE: Record<string, BadgeKey> = {
  draft: 'draft',
  pending_review: 'pending_review',
  active: 'active',
  paused: 'paused',
  sold: 'sold',
  expired: 'expired',
  rejected: 'rejected',
};

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();

  // Server guarantees: null for sold / non-revealed phones.
  const phone = await getSellerPhone(listing.id);
  const published = new Date(listing.publishedAt ?? Date.now());
  const sold = listing.state === 'sold';

  const badges: BadgeKey[] = [];
  if (listing.state !== 'active') badges.push(STATE_BADGE[listing.state] ?? 'active');
  badges.push(listing.condition === 'new' ? 'new' : 'used');
  if (listing.plateType === 'kish') badges.push('kish_plate');
  if (listing.plateType === 'temporary_transit' || listing.plateType === 'unplated') {
    badges.push('temporary_transit');
  }
  if (listing.hasReport) badges.push('verified_report');

  const specs: Array<{ icon: 'mileage' | 'gear' | 'fuel' | 'plate' | 'car'; label: string; value: string }> = [
    { icon: 'mileage', label: 'کارکرد', value: `${toPersianDigits(groupDigits(listing.mileageKm))} کیلومتر` },
    { icon: 'gear', label: 'گیربکس', value: GEARBOX_LABELS[listing.gearbox] },
    { icon: 'fuel', label: 'سوخت', value: FUEL_LABELS[listing.fuel] },
    { icon: 'plate', label: 'وضعیت پلاک', value: PLATE_TYPE_LABELS[listing.plateType] },
    { icon: 'car', label: 'نوع', value: CONDITION_LABELS[listing.condition] },
  ];

  return (
    <article className="space-y-5">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink"
      >
        <Icon name="arrowLeft" size={18} />
        بازگشت به آگهی‌ها
      </Link>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative aspect-[var(--photo-aspect)] overflow-hidden rounded-card border border-line bg-sunken">
            {listing.coverUrl ? (
              <Image
                src={listing.coverUrl}
                alt={`${listing.model} ${listing.year}`}
                fill
                sizes="(min-width: 1024px) 66vw, 100vw"
                className={`object-cover ${sold ? 'opacity-60 grayscale' : ''}`}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-faint">
                <Icon name="camera" size={40} />
                <span className="text-sm">بدون عکس</span>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-card border border-line bg-card p-4 sm:p-5">
            <h1 className="text-xl font-extrabold leading-tight">
              {listing.model}
              {listing.trim ? ` ${listing.trim}` : ''} — {toPersianDigits(listing.year)}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {badges.map((b) => {
                const token = badgeFor(b);
                return (
                  <span
                    key={b}
                    className="rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs font-bold"
                    style={{
                      background: token.background,
                      color: token.foreground,
                      borderColor: token.border,
                    }}
                  >
                    {token.label}
                  </span>
                );
              })}
            </div>

            <p className={`mt-3 text-2xl font-extrabold ${sold ? 'text-muted' : 'text-ink'}`}>
              {formatIRR(listing.priceIRR)}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {specs.map((spec) => (
                <div key={spec.label} className="rounded-field border border-line bg-page p-3">
                  <dt className="flex items-center gap-1.5 text-xs font-bold text-muted">
                    <Icon name={spec.icon} size={16} />
                    {spec.label}
                  </dt>
                  <dd className="mt-1 text-sm font-extrabold">{spec.value}</dd>
                </div>
              ))}
              <div className="rounded-field border border-line bg-page p-3">
                <dt className="flex items-center gap-1.5 text-xs font-bold text-muted">
                  <Icon name="car" size={16} />
                  رنگ
                </dt>
                <dd className="mt-1 text-sm font-extrabold">{COLOR_LABELS[listing.color]}</dd>
              </div>
              <div className="rounded-field border border-line bg-page p-3">
                <dt className="flex items-center gap-1.5 text-xs font-bold text-muted">
                  <Icon name="clock" size={16} />
                  تاریخ انتشار
                </dt>
                <dd className="mt-1 text-sm font-extrabold">
                  <time dateTime={published.toISOString()}>{formatJalaliDate(published)}</time>
                </dd>
              </div>
            </dl>

            {listing.description && (
              <div className="mt-5 border-t border-line pt-4">
                <h2 className="text-sm font-extrabold text-ink">توضیحات فروشنده</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted">
                  {listing.description}
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-card border border-line bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">
                  {listing.showroomName ?? 'فروشنده حقیقی'}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-muted">
                  {CITY_LABELS[listing.city] ?? listing.city}
                  {listing.showroomVerified && (
                    <span className="flex items-center gap-1 text-note">
                      · نمایشگاه معتبر
                      <Icon name="badgeCheck" size={14} />
                    </span>
                  )}
                </p>
              </div>
              <FavoriteButton slug={listing.slug} />
            </div>

            <div className="mt-4 border-t border-line pt-4">
              {listing.state === 'active' ? (
                <ContactButtons phone={phone} />
              ) : (
                <p className="rounded-field border border-line bg-page p-3 text-center text-sm font-bold text-muted">
                  این آگهی فروخته شده است؛ امکان تماس وجود ندارد.
                </p>
              )}
            </div>
          </div>

          {listing.hasReport && (
            <div className="rounded-card border border-line bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-extrabold text-note">
                <Icon name="shieldCheck" size={18} />
                دارای گزارش بازرسی معتبر کارگاه
              </p>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
