import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { badgeFor, type BadgeKey } from '@studio/design';
import {
  CITY_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
  PART_CATEGORY_LABELS,
  PART_CONDITION_LABELS,
  PART_ORIGIN_LABELS,
  PLATE_TYPE_LABELS,
  compatibilityLabel,
} from '@alisales/schemas';
import { ContactButtons } from '@/components/ContactButtons';
import { FavoriteButton } from '@/components/FavoriteButton';
import { Icon } from '@/components/Icon';
import { ReportListingButton } from '@/components/ReportListingButton';
import { PriceText } from '@/components/PriceText';
import { VerifiedPill, sellerDisplayName } from '@/components/SellerVerified';
import { SoldBadge } from '@/components/SoldBadge';
import { getListing, getSellerPhone } from '@/lib/data/listings';
import { getSession } from '@/lib/auth/session';
import { recordView } from '@/lib/data/s2-store';
import { shouldRecordView } from '@/lib/data/stats-rules';

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
  const sold = listing.state === 'sold';
  const part = listing.part ?? null;

  // Owner statistics (C2): one unique view per visitor; the owner's own visit
  // never counts, so posting age and «بازدید» stay honest.
  const session = await getSession();
  if (shouldRecordView(session?.sub, listing.sellerId)) {
    await recordView(listing.id, session!.sub);
  }

  const badges: BadgeKey[] = [];
  if (listing.state !== 'active' && listing.state !== 'sold') {
    badges.push(STATE_BADGE[listing.state] ?? 'active');
  }
  badges.push(listing.condition === 'new' ? 'new' : 'used');
  if (!part) {
    if (listing.plateType === 'kish') badges.push('kish_plate');
    if (listing.plateType === 'temporary_transit' || listing.plateType === 'unplated') {
      badges.push('temporary_transit');
    }
  }
  if (listing.hasReport) badges.push('verified_report');

  type DetailSpec = {
    icon: 'mileage' | 'gear' | 'fuel' | 'plate' | 'car' | 'shieldCheck';
    label: string;
    value: string;
  };

  // Detail specifications carry the car's facts only — the relative posting
  // age belongs to the browse cards and rows, never to this block.
  const specs: DetailSpec[] = part
    ? [
        { icon: 'car', label: 'دسته‌بندی', value: PART_CATEGORY_LABELS[part.category] },
        { icon: 'shieldCheck', label: 'منشأ', value: PART_ORIGIN_LABELS[part.origin] },
        { icon: 'car', label: 'سازگاری', value: compatibilityLabel(part.compatibility) },
        ...(part.partNumber
          ? [{ icon: 'gear' as const, label: 'شماره فنی', value: part.partNumber }]
          : []),
        ...(part.warranty
          ? [{ icon: 'shieldCheck' as const, label: 'گارانتی', value: part.warranty }]
          : []),
        { icon: 'car', label: 'وضعیت', value: PART_CONDITION_LABELS[part.condition] },
      ]
    : [
        { icon: 'car', label: 'سال ساخت', value: String(listing.year) },
        { icon: 'mileage', label: 'کیلومتراژ', value: `${listing.mileageKm} کیلومتر` },
        { icon: 'gear', label: 'گیربکس', value: GEARBOX_LABELS[listing.gearbox] },
        {
          icon: 'plate',
          label: 'وضعیت سوخت و پلاک',
          value: `${FUEL_LABELS[listing.fuel]} · ${PLATE_TYPE_LABELS[listing.plateType]}`,
        },
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
                alt={part ? part.title : `${listing.model} ${listing.year}`}
                fill
                sizes="(min-width: 1024px) 66vw, 100vw"
                unoptimized={listing.coverUrl.endsWith('.svg')}
                className={`object-cover ${sold ? 'opacity-60 grayscale' : ''}`}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-faint">
                <Icon name="camera" size={40} />
                <span className="text-sm">بدون عکس</span>
              </div>
            )}
          </div>

          {listing.photos.length > 1 && (
            <ul className="mt-2 grid grid-cols-4 gap-2">
              {listing.photos.slice(1, 9).map((url, index) => (
                <li
                  key={url}
                  className="relative aspect-[var(--photo-aspect)] overflow-hidden rounded-field border border-line bg-sunken"
                >
                  <Image
                    src={url}
                    alt={`عکس ${index + 2}`}
                    fill
                    sizes="(min-width: 1024px) 16vw, 25vw"
                    unoptimized={url.endsWith('.svg')}
                    className="object-cover"
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 rounded-card border border-line bg-card p-4 sm:p-5">
            <h1
              className="text-xl font-extrabold leading-tight"
              style={sold ? { color: '#64748B' } : undefined}
            >
              {part
                ? part.title
                : `${listing.model}${listing.trim ? ` ${listing.trim}` : ''} — ${listing.year}`}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {sold && <SoldBadge size="lg" />}
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

            <div className="mt-3">
              <PriceText irr={listing.priceIRR} sold={sold} size="lg" />
            </div>

            <dl
              className={`mt-4 grid grid-cols-2 gap-3 ${part ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}
            >
              {specs.map((spec) => (
                <div key={spec.label} className="rounded-field border border-line bg-page p-3">
                  <dt className="flex items-center gap-1.5 text-xs font-bold text-muted">
                    <Icon name={spec.icon} size={16} />
                    {spec.label}
                  </dt>
                  <dd className="mt-1 text-sm font-extrabold">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-4 rounded-card border border-line bg-card p-4 sm:p-5">
            <h2 className="text-base font-extrabold text-ink">توضیحات آگهی</h2>
            <p className="mt-3 whitespace-pre-line text-justify text-sm leading-8 text-ink/85">
              {listing.description?.trim() || 'فروشنده برای این آگهی توضیحی ثبت نکرده است.'}
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-card border border-line bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                {listing.showroomVerified ? (
                  <VerifiedPill label={part ? 'تعمیرگاه معتبر' : 'نمایشگاه معتبر'} />
                ) : (
                  <p className="truncate text-sm font-extrabold">
                    {sellerDisplayName(listing.showroomName) ?? 'فروشنده حقیقی'}
                  </p>
                )}
                <p className="mt-1 text-xs font-bold text-muted">
                  {CITY_LABELS[listing.city] ?? listing.city}
                </p>
              </div>
              <FavoriteButton slug={listing.slug} listingId={listing.id} />
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <ContactButtons
                listingId={listing.id}
                slug={listing.slug}
                phone={phone}
                sold={sold}
                revealable={listing.allowPhoneReveal && !sold}
              />
            </div>

            {(!session || session.sub !== listing.sellerId) && (
              <div className="mt-3 border-t border-line pt-3">
                <ReportListingButton listingId={listing.id} />
              </div>
            )}
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

      <p className="rounded-card border border-line bg-card p-4 text-xs leading-6 text-muted">
        Ali Sales فقط محل نمایش آگهی است. خرید و فروش و پرداخت بین خود کاربران انجام می‌شود.
      </p>
    </article>
  );
}
