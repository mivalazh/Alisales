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
  compatibilityLabel,
} from '@alisales/schemas';
import { ContactButtons } from '@/components/ContactButtons';
import { ListingGallery } from '@/components/ListingGallery';
import { FavoriteButton } from '@/components/FavoriteButton';
import { Icon } from '@/components/Icon';
import { ReportListingButton } from '@/components/ReportListingButton';
import { PriceText } from '@/components/PriceText';
import { RateLine } from '@/components/RateLine';
import { VerifiedPill, sellerDisplayName } from '@/components/SellerVerified';
import { SoldBadge } from '@/components/SoldBadge';
import { getListing, getSellerPhone } from '@/lib/data/listings';
import { brandLatinFor, vehicleTitle } from '@/lib/listing-text';
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

/**
 * Listing detail (desktop re-architecture).
 *
 * Two columns on `lg`, read right-to-left: the 7-span column on the right holds
 * the evidence — a compact 16:10 gallery (capped at 420px so a landscape photo
 * never owns the screen), its thumbnails, the description and the inspection
 * note. The 5-span column on the left is the decision column: status tags,
 * title, the Toman headline with its AED reference, the four spec tiles, and
 * directly underneath the seller/contact actions. It sticks while the right
 * column scrolls, so price and «چت با آگهی‌دهنده» are always one glance away.
 */
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
        // The plate already has its own badge above the title, so the tile
        // carries the fuel only — no duplicated «پلاک کیش» in two places.
        {
          icon: 'fuel',
          label: 'سوخت',
          value: FUEL_LABELS[listing.fuel],
        },
      ];

  return (
    <article className="mx-auto max-w-6xl space-y-5">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink"
      >
        <Icon name="arrowLeft" size={18} />
        بازگشت به آگهی‌ها
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Right column in RTL: the photographic evidence and the story. */}
        <div className="min-w-0 space-y-4 lg:col-span-7">
          <ListingGallery
            photos={listing.photos.length > 0 ? listing.photos : listing.coverUrl ? [listing.coverUrl] : []}
            alt={part ? part.title : `${listing.model} ${listing.year}`}
            sold={sold}
          />

          <section className="rounded-card border border-line bg-card p-4 sm:p-5">
            <h2 className="text-base font-extrabold text-ink">توضیحات آگهی</h2>
            <p className="mt-3 whitespace-pre-line text-justify text-sm leading-8 text-ink/85">
              {listing.description?.trim() || 'فروشنده برای این آگهی توضیحی ثبت نکرده است.'}
            </p>
          </section>

          {listing.hasReport && (
            <div className="rounded-card border border-line bg-card p-4">
              <p className="flex items-center gap-2 text-sm font-extrabold text-note">
                <Icon name="shieldCheck" size={18} />
                دارای گزارش بازرسی معتبر کارگاه
              </p>
            </div>
          )}
        </div>

        {/* Left column in RTL: the decision block, sticky on desktop. */}
        <aside className="flex flex-col gap-4 lg:col-span-5 lg:sticky lg:top-24">
          <div className="rounded-card border border-line bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-1.5">
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

            {/* Latin marque above the model, LTR and bidi-isolated so a mixed
                Persian/Latin title never reorders. */}
            {!part && brandLatinFor(listing.brand) && (
              <p
                dir="ltr"
                className="mt-3 text-start text-xs font-extrabold uppercase tracking-[0.1em] text-muted"
              >
                {brandLatinFor(listing.brand)}
              </p>
            )}
            <h1
              className={`${part ? 'mt-3' : 'mt-1'} text-lg font-extrabold leading-tight sm:text-xl`}
              style={sold ? { color: '#64748B' } : undefined}
            >
              {part ? (
                part.title
              ) : (
                <>
                  <bdi>{vehicleTitle(listing)}</bdi>
                  {listing.year > 0 && <span className="font-bold"> — {listing.year}</span>}
                </>
              )}
            </h1>

            <div className="mt-3">
              <PriceText
                irr={listing.priceIRR}
                sold={sold}
                hideAed={listing.hideAed}
                size="lg"
              />
              {/* One rate for the whole product: the number and its «آخرین
                  بروزرسانی» stamp sit under every AED reference. */}
              <div className="mt-1.5">
                <RateLine />
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2">
              {specs.map((spec) => (
                <div key={spec.label} className="rounded-field border border-line bg-page p-2.5">
                  <dt className="flex items-center gap-1.5 text-[11px] font-bold text-muted">
                    <Icon name={spec.icon} size={14} />
                    {spec.label}
                  </dt>
                  <dd className="mt-1 text-xs font-extrabold leading-5 text-ink">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>

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

            <Link
              href={`/seller/${listing.sellerId}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-muted underline transition hover:text-ink"
            >
              <Icon name="user" size={14} />
              مشاهده‌ی پروفایل فروشنده
            </Link>

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
        </aside>
      </div>
    </article>
  );
}
