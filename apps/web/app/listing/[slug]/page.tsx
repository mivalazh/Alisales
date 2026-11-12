import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { badgeFor, type BadgeKey } from '@studio/design';
import {
  BODY_TYPE_LABELS,
  CHASSIS_CONDITION_LABELS,
  CITY_LABELS,
  PAINT_CONDITION_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
  PART_CATEGORY_LABELS,
  PART_CONDITION_LABELS,
  PART_ORIGIN_LABELS,
  colorLabel,
  compatibilityLabel,
} from '@alisales/schemas';
import { ContactButtons } from '@/components/ContactButtons';
import { InspectionOffer } from '@/components/InspectionOffer';
import { ListingGallery } from '@/components/ListingGallery';
import { InspectionSheetLightbox } from '@/components/InspectionSheetLightbox';
import { NativeBackHeader } from '@/components/NativeBackHeader';
import { FavoriteButton } from '@/components/FavoriteButton';
import { Icon } from '@/components/Icon';
import { ReportListingButton } from '@/components/ReportListingButton';
import { DeleteListingButton } from '@/components/DeleteListingButton';
import { PriceText } from '@/components/PriceText';
import { RateLine } from '@/components/RateLine';
import { VerifiedPill, sellerDisplayName } from '@/components/SellerVerified';
import { SoldBadge } from '@/components/SoldBadge';
import { getListing, getSellerPhone } from '@/lib/data/listings';
import { brandLatinFor, vehicleTitle } from '@/lib/listing-text';
import { translateListingContentToEn } from '@/lib/i18n/content';
import { absoluteUrl } from '@/lib/seo';
import { getSession } from '@/lib/auth/session';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';
import { recordView } from '@/lib/data/s2-store';
import { shouldRecordView } from '@/lib/data/stats-rules';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [listing, lang] = await Promise.all([getListing(slug), getLanguage()]);
  if (!listing) return { title: 'Listing not found' };
  const isEn = lang === 'en';
  const rawTitle = listing.part ? listing.part.title : vehicleTitle(listing);
  const title = isEn ? translateListingContentToEn(rawTitle) : rawTitle;
  const description = listing.description?.trim()
    ? isEn
      ? translateListingContentToEn(listing.description).slice(0, 160)
      : listing.description.slice(0, 160)
    : isEn
      ? `Used ${translateListingContentToEn(rawTitle)} in Kish with a workshop inspection.`
      : `${rawTitle} در کیش با امکان کارشناسی تعمیرگاه.`;
  return {
    title: `${title}${listing.year ? ` — ${listing.year}` : ''}`,
    description,
    alternates: { canonical: `/listing/${listing.slug}` },
    openGraph: {
      title: `${title}${listing.year ? ` — ${listing.year}` : ''}`,
      description,
      url: absoluteUrl(`/listing/${listing.slug}`),
      ...(listing.coverUrl ? { images: [{ url: listing.coverUrl }] } : {}),
    },
  };
}

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
  const [listing, lang] = await Promise.all([getListing(slug), getLanguage()]);
  if (!listing) notFound();
  const t = (fa: string, en?: string) => serverT(lang, fa, en);

  // Server guarantees: null for sold / non-revealed phones.
  const phone = await getSellerPhone(listing.id);
  const sold = listing.state === 'sold';
  const part = listing.part ?? null;
  const rawTitle = part ? part.title : vehicleTitle(listing);
  const displayTitle =
    lang === 'en' ? translateListingContentToEn(rawTitle) : rawTitle;
  const displayDescription = listing.description?.trim()
    ? lang === 'en'
      ? translateListingContentToEn(listing.description)
      : listing.description
    : null;
  const displaySeller =
    listing.showroomName && lang === 'en'
      ? translateListingContentToEn(listing.showroomName)
      : listing.showroomName;

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

  type DetailSpec = {
    icon: 'mileage' | 'gear' | 'fuel' | 'plate' | 'car' | 'shieldCheck';
    label: string;
    value: string;
  };

  // Detail specifications carry the car's facts only — the relative posting
  // age belongs to the browse cards and rows, never to this block.
  const specs: DetailSpec[] = part
    ? [
        { icon: 'car', label: t('دسته‌بندی'), value: t(PART_CATEGORY_LABELS[part.category]) },
        { icon: 'shieldCheck', label: t('اصالت'), value: t(PART_ORIGIN_LABELS[part.origin]) },
        ...(part.originCountry
          ? [
              {
                icon: 'plate' as const,
                label: t('کشور سازنده'),
                value:
                  lang === 'en'
                    ? translateListingContentToEn(part.originCountry)
                    : part.originCountry,
              },
            ]
          : []),
        { icon: 'car', label: t('سازگاری'), value: compatibilityLabel(part.compatibility) },
        ...(part.partNumber
          ? [{ icon: 'gear' as const, label: t('شماره فنی'), value: part.partNumber }]
          : []),
        ...(part.warranty
          ? [
              {
                icon: 'shieldCheck' as const,
                label: t('گارانتی'),
                value:
                  lang === 'en'
                    ? translateListingContentToEn(part.warranty)
                    : part.warranty,
              },
            ]
          : []),
        { icon: 'car', label: t('وضعیت'), value: t(PART_CONDITION_LABELS[part.condition]) },
      ]
    : [
        { icon: 'car', label: t('سال ساخت'), value: String(listing.year) },
        { icon: 'mileage', label: t('کیلومتراژ'), value: `${listing.mileageKm} ${t('کیلومتر')}` },
        { icon: 'gear', label: t('گیربکس'), value: t(GEARBOX_LABELS[listing.gearbox]) },
        // The plate already has its own badge above the title, so the tile
        // carries the fuel only — no duplicated «پلاک کیش» in two places.
        {
          icon: 'fuel',
          label: t('سوخت'),
          value: t(FUEL_LABELS[listing.fuel]),
        },
      ];

  /**
   * Every secondary spec the seller filled, minus the four tiles above, as
   * pill tags under the description. Colour, body class, engine size, part
   * number, warranty and compatibility all land here instead of being lost.
   */
  const extraSpecs: { label: string; value: string; positive?: boolean }[] = [];
  const pushSpec = (
    label: string,
    value: string | null | undefined,
    positive = false,
  ) => {
    const text = (value ?? '').trim();
    if (text) extraSpecs.push({ label, value: text, ...(positive ? { positive } : {}) });
  };
  if (listing.kind === 'part' && part) {
    pushSpec(
      t('کشور سازنده'),
      lang === 'en' && part.originCountry
        ? translateListingContentToEn(part.originCountry)
        : part.originCountry ?? null,
    );
    pushSpec(t('شماره فنی'), part.partNumber);
    pushSpec(
      t('گارانتی'),
      lang === 'en' && part.warranty
        ? translateListingContentToEn(part.warranty)
        : part.warranty,
    );
    if (part.compatibility) {
      pushSpec(
        t('سازگاری خودرو'),
        lang === 'en' ? translateListingContentToEn(part.compatibility) : part.compatibility,
      );
    }
  } else if (listing.kind !== 'part') {
    pushSpec(
      t('رنگ'),
      lang === 'en'
        ? translateListingContentToEn(colorLabel(listing.color))
        : t(colorLabel(listing.color)),
    );
    pushSpec(
      t('تیپ / کلاس بدنه'),
      listing.bodyType ? t(BODY_TYPE_LABELS[listing.bodyType]) : null,
    );
    if (listing.engineCc) pushSpec(t('توان / حجم موتور'), `${listing.engineCc} cc`);
    if (listing.category === 'heavy' && listing.workingHours) {
      pushSpec(t('ساعت کارکرد'), `${listing.workingHours} ${t('ساعت')}`);
    }
    // Seller-declared condition facts — detailed here, never on the grid card.
    if (listing.thirdPartyInsurance !== null && listing.thirdPartyInsurance !== undefined) {
      pushSpec(
        t('بیمه شخص ثالث'),
        listing.thirdPartyInsurance
          ? lang === 'en'
            ? `Yes${listing.thirdPartyMonths ? ` · ${listing.thirdPartyMonths} months remaining` : ''}`
            : `${t('دارد')}${listing.thirdPartyMonths ? ` · ${listing.thirdPartyMonths} ${t('ماه اعتبار')}` : ''}`
          : t('ندارد'),
        listing.thirdPartyInsurance,
      );
    }
    if (listing.bodyInsurance !== null && listing.bodyInsurance !== undefined) {
      pushSpec(
        t('بیمه بدنه'),
        listing.bodyInsurance
          ? lang === 'en'
            ? `Yes${listing.bodyMonths ? ` · ${listing.bodyMonths} months remaining` : ''}`
            : `${t('دارد')}${listing.bodyMonths ? ` · ${listing.bodyMonths} ${t('ماه اعتبار')}` : ''}`
          : t('ندارد'),
        listing.bodyInsurance,
      );
    }
    if (listing.paintCondition) {
      pushSpec(
        t('وضعیت رنگ و بدنه'),
        t(
          PAINT_CONDITION_LABELS[
            listing.paintCondition as keyof typeof PAINT_CONDITION_LABELS
          ] ?? listing.paintCondition,
        ),
        listing.paintCondition === 'factory',
      );
    }
    if (listing.chassisCondition) {
      pushSpec(
        t('وضعیت شاسی'),
        t(
          CHASSIS_CONDITION_LABELS[
            listing.chassisCondition as keyof typeof CHASSIS_CONDITION_LABELS
          ] ?? listing.chassisCondition,
        ),
        listing.chassisCondition === 'sealed',
      );
    }
    if (listing.technicalInspection !== null && listing.technicalInspection !== undefined) {
      pushSpec(
        t('معاینه فنی'),
        listing.technicalInspection ? t('دارد') : t('ندارد'),
        listing.technicalInspection,
      );
    }
    if (listing.isJournalPhoto) pushSpec(t('عکس ژورنالی'), t('دارد'), true);
    if (listing.inspectionSheetUrl) pushSpec(t('برگه کارشناسی'), t('دارد'), true);
  }

  /** «توضیحات آگهی» + its extra-spec tags. Rendered once: on phones it sits
   * directly under the title/price card (above the seller card) because that
   * is the reading order a buyer on a phone expects; on desktop it stays in
   * the evidence column under the gallery. */
  const descriptionCard = (
    <section className="rounded-card border border-line bg-card p-4 sm:p-5">
      <h2 className="text-base font-extrabold text-ink">{t('توضیحات آگهی')}</h2>
      <p className="mt-3 whitespace-pre-line text-justify text-sm leading-8 text-ink/85">
        {displayDescription || t('فروشنده برای این آگهی توضیحی ثبت نکرده است.')}
      </p>

      {extraSpecs.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="mb-3 text-sm font-extrabold text-ink">{t('مشخصات تکمیلی')}</h3>
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {extraSpecs.map((spec) => (
              <div
                key={`${spec.label}-${spec.value}`}
                className="flex flex-col gap-1 rounded-xl border border-slate-200/70 bg-[#F4F1EC]/60 p-3 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <dt className="text-xs text-slate-500 dark:text-slate-400">{spec.label}</dt>
                <dd className="flex items-center gap-1.5 text-sm font-bold text-[#111144] dark:text-[#F4F1EC]">
                  {spec.positive && (
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                    />
                  )}
                  <span className="min-w-0 break-words">{spec.value}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {listing.inspectionSheetUrl && (
        <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 dark:border-emerald-400/20 dark:bg-emerald-400/[0.07]">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Icon name="shieldCheck" size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-ink">
                {t('برگه کارشناسی بارگذاری‌شده', 'Uploaded inspection sheet')}
              </p>
              <p className="mt-1 text-xs leading-6 text-muted">
                {t(
                  'تصویر اصلی برگه‌ای که فروشنده بارگذاری کرده است.',
                  'The original sheet uploaded by the seller.',
                )}
              </p>
              <InspectionSheetLightbox
                src={listing.inspectionSheetUrl}
                label={t('مشاهده برگه کارشناسی', 'View inspection sheet')}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );

  return (
    <article className="mx-auto max-w-6xl space-y-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': part ? 'Product' : ['Vehicle', 'Product'],
                '@id': absoluteUrl(`/listing/${listing.slug}#product`),
                name: displayTitle,
                description: displayDescription ?? undefined,
                url: absoluteUrl(`/listing/${listing.slug}`),
                ...(listing.coverUrl ? { image: [listing.coverUrl] } : {}),
                ...(part
                  ? { category: part.category, brand: { '@type': 'Brand', name: 'Ali Sales' } }
                  : {
                      brand: { '@type': 'Brand', name: brandLatinFor(listing.brand) ?? listing.brand },
                      vehicleModelDate: String(listing.year),
                      mileageFromOdometer: {
                        '@type': 'QuantitativeValue',
                        value: listing.mileageKm,
                        unitCode: 'KMT',
                      },
                      bodyType: listing.bodyType ?? undefined,
                      color: listing.color,
                    }),
                offers: {
                  '@type': 'Offer',
                  price: listing.priceIRR,
                  priceCurrency: 'IRR',
                  availability: sold
                    ? 'https://schema.org/SoldOut'
                    : 'https://schema.org/InStock',
                  itemCondition:
                    listing.condition === 'new'
                      ? 'https://schema.org/NewCondition'
                      : 'https://schema.org/UsedCondition',
                  url: absoluteUrl(`/listing/${listing.slug}`),
                  seller: { '@type': 'Organization', name: displaySeller ?? 'Ali Sales' },
                },
              },
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: displayTitle,
                    item: absoluteUrl(`/listing/${listing.slug}`),
                  },
                ],
              },
            ],
          }).replace(/</g, '\\u003c'),
        }}
      />
      <NativeBackHeader
        title={displayTitle}
        fallbackHref="/"
      />
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink"
      >
        <Icon name="arrowLeft" size={18} />
        {t('بازگشت به آگهی‌ها')}
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Right column in RTL: the photographic evidence and the story. */}
        <div className="min-w-0 space-y-4 lg:col-span-7">
          <ListingGallery
            photos={listing.photos.length > 0 ? listing.photos : listing.coverUrl ? [listing.coverUrl] : []}
            alt={part ? displayTitle : `${translateListingContentToEn(listing.model)} ${listing.year}`}
            sold={sold}
          />

          <div className="hidden lg:block">{descriptionCard}</div>

        </div>

        {/* Left column in RTL: the decision block, sticky on desktop. */}
        <aside className="flex flex-col gap-4 lg:col-span-5 lg:sticky lg:top-24">
          <div className="rounded-card border border-line bg-card p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
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
                      {t(token.label)}
                    </span>
                  );
                })}
              </div>
              {/* Save action lives with the status row: the summary card's
                  opposite corner, not buried in the seller card below. */}
              <FavoriteButton slug={listing.slug} listingId={listing.id} className="shrink-0" />
            </div>

            {/* Latin marque above the model, on the same start edge. */}
            {!part && brandLatinFor(listing.brand) && (
              <p className="mt-3 max-w-full truncate text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
                <bdi dir="ltr">{brandLatinFor(listing.brand)}</bdi>
              </p>
            )}
            <h1
              className={`${part ? 'mt-3' : 'mt-1'} text-lg font-extrabold leading-tight sm:text-xl`}
              style={sold ? { color: '#64748B' } : undefined}
            >
              {part ? (
                displayTitle
              ) : (
                <>
                  <bdi>{displayTitle}</bdi>
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

          {/* Phone order: title/price card → description → seller card. */}
          <div className="lg:hidden">{descriptionCard}</div>

          <div className="rounded-card border border-line bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                {listing.showroomVerified ? (
                  <VerifiedPill label={t(part ? 'تعمیرگاه معتبر' : 'نمایشگاه معتبر')} />
                ) : (
                  <p className="truncate text-sm font-extrabold">
                    {displaySeller ?? t('فروشنده حقیقی', 'Private seller')}
                  </p>
                )}
                <p className="mt-1 text-xs font-bold text-muted">
                  {t(CITY_LABELS[listing.city] ?? listing.city)}
                </p>
              </div>
            </div>

            <Link
              href={`/seller/${listing.sellerId}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-muted underline transition hover:text-ink"
            >
              <Icon name="user" size={14} />
              {t('مشاهده‌ی پروفایل فروشنده', 'View seller profile')}
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

            {session?.sub === listing.sellerId ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                <Link
                  href={`/edit/${listing.id}`}
                  className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-xs font-extrabold text-ink transition hover:border-line-strong"
                >
                  <Icon name="pencil" size={14} />
                  {t('ویرایش آگهی', 'Edit listing')}
                </Link>
                <DeleteListingButton
                  id={listing.id}
                  redirectTo={`/seller/${listing.sellerId}`}
                  compact
                />
              </div>
            ) : (
              <div className="mt-3 border-t border-line pt-3">
                <ReportListingButton listingId={listing.id} />
              </div>
            )}
          </div>

          <InspectionOffer
            listingSlug={listing.slug}
            listingTitle={displayTitle}
          />
        </aside>
      </div>
    </article>
  );
}
