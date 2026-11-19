'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import { badgeFor, type BadgeKey } from '@studio/design';
import { CITY_LABELS, PART_CONDITION_LABELS, postingAgeLabel } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import { brandLatinFor, vehicleTitle } from '@/lib/listing-text';
import { useI18n } from '@/lib/i18n';
import { translateListingContentToEn } from '@/lib/i18n/content';
import { postingAgeEnglish } from '@/lib/i18n/dictionary';
import { FavoriteButton } from './FavoriteButton';
import { Icon } from './Icon';
import { PriceText } from './PriceText';
import { SoldBadge } from './SoldBadge';
import { VerifiedPill, sellerDisplayName } from './SellerVerified';
import { isPreSizedSource } from '@/lib/images';

/** Sold text tone — muted so the carmine badge carries the emphasis. */
const SOLD_TEXT = '#64748B';
/** Horizontal travel (px) that counts as a photo swipe rather than a tap. */
const SWIPE_THRESHOLD = 35;

function Badge({ badgeKey }: { badgeKey: BadgeKey }) {
  const { t } = useI18n();
  const b = badgeFor(badgeKey);
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold sm:text-[11px]"
      style={{ background: b.background, color: b.foreground, borderColor: b.border }}
    >
      {t(b.label)}
    </span>
  );
}

function plateBadgeKey(plateType: ListingCardData['plateType']): BadgeKey | null {
  if (plateType === 'kish') return 'kish_plate';
  if (plateType === 'temporary_transit') return 'temporary_transit';
  return null;
}

/** Lifecycle states other than sold keep their design badge. */
const STATE_BADGE: Record<Exclude<ListingCardData['state'], 'sold'>, BadgeKey> = {
  draft: 'draft',
  pending_review: 'pending_review',
  active: 'active',
  paused: 'paused',
  expired: 'expired',
  rejected: 'rejected',
};

function cardBadges(listing: ListingCardData): BadgeKey[] {
  const badges: BadgeKey[] = [];
  if (listing.state !== 'active' && listing.state !== 'sold') {
    badges.push(STATE_BADGE[listing.state]);
  }
  // Parts carry their own three-state condition (new / stock / used) below;
  // the vehicle `new`/`used` badge would mislabel an imported stock part.
  if (!listing.part) badges.push(listing.condition === 'new' ? 'new' : 'used');
  const plate = listing.part ? null : plateBadgeKey(listing.plateType);
  if (plate) badges.push(plate);
  return badges;
}

/**
 * Catalog card. Posting age is relative text on Tehran calendar days (C8);
 * year, mileage and price always render with Latin digits.
 *
 * The cover frame is browsable before the detail page: arrows step through the
 * gallery, touch devices swipe, and a counter shows where you are. The bookmark
 * sits in the photo's top-start corner (top-right in RTL) and the whole card is
 * covered by one stretched link, so a tap anywhere opens the listing. Arrow and
 * bookmark stay above that link and never navigate.
 */
export function ListingCard({ listing }: { listing: ListingCardData }) {
  const { lang, t } = useI18n();
  const sold = listing.state === 'sold';
  const part = listing.part ?? null;
  const rawTitle = part ? part.title : vehicleTitle(listing);
  const title = lang === 'en' ? translateListingContentToEn(rawTitle) : rawTitle;
  const rawSeller = sellerDisplayName(listing.showroomName);
  const sellerName =
    rawSeller && lang === 'en' ? translateListingContentToEn(rawSeller) : rawSeller;
  // Latin marque on its own line, spec facts as separate items — see
  // lib/listing-text.ts for why both are bdi/dir guarded.
  const latin = part ? null : brandLatinFor(listing.brand);

  const photos = listing.photos?.length
    ? listing.photos
    : listing.coverUrl
      ? [listing.coverUrl]
      : [];
  const count = photos.length;
  const [index, setIndex] = useState(0);
  const current = photos[index] ?? null;
  const touchX = useRef<number | null>(null);
  const touchDelta = useRef(0);
  const swiped = useRef(false);

  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  const onTouchStart = (event: TouchEvent<HTMLLIElement>) => {
    touchX.current = event.touches[0]?.clientX ?? null;
    touchDelta.current = 0;
    swiped.current = false;
  };

  const onTouchMove = (event: TouchEvent<HTMLLIElement>) => {
    const start = touchX.current;
    const current = event.touches[0]?.clientX;
    if (start === null || current === undefined) return;
    touchDelta.current = current - start;
  };

  const onTouchEnd = (event: TouchEvent<HTMLLIElement>) => {
    const start = touchX.current;
    const end = event.changedTouches[0]?.clientX;
    const dx = touchDelta.current || (start !== null && end !== undefined ? end - start : 0);
    touchX.current = null;
    touchDelta.current = 0;
    if (count < 2 || Math.abs(dx) < SWIPE_THRESHOLD) return;
    go(dx > 0 ? -1 : 1);
    swiped.current = true;
  };

  const onLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (swiped.current) {
      event.preventDefault();
      swiped.current = false;
    }
  };

  return (
    <li
      className="group relative flex h-full min-w-0 touch-pan-y flex-col overflow-hidden rounded-card border border-line bg-card transition hover:border-line-strong hover:shadow-lg active:scale-[0.98]"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* A slightly taller frame on phones: the spec line no longer costs a
          row of height, so the extra image height keeps the card balanced. */}
      <div className="relative aspect-[5/4] bg-sunken sm:aspect-[var(--photo-aspect)]">
        {current ? (
          <Image
            src={current}
            alt={part ? title : `${translateListingContentToEn(listing.model)} ${listing.year}`}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 50vw"
            unoptimized={isPreSizedSource(current)}
            loading="lazy"
            decoding="async"
            className={`object-cover ${sold ? 'opacity-60 grayscale' : ''}`}
          />
        ) : (
          <NoImagePlaceholder />
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t('عکس قبلی', 'Previous photo')}
              className="absolute start-2 top-1/2 z-20 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111144] shadow-md transition-opacity duration-150 hover:bg-white md:flex md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              <Icon name="chevronRight" size={14} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t('عکس بعدی', 'Next photo')}
              className="absolute end-2 top-1/2 z-20 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111144] shadow-md transition-opacity duration-150 hover:bg-white md:flex md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              <Icon name="chevronLeft" size={14} />
            </button>
            <span className="absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1">
              {photos.slice(0, 6).map((url, i) => (
                <span
                  key={`${url}-${i}`}
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full transition ${
                    i === index ? 'bg-white' : 'bg-white/45'
                  }`}
                />
              ))}
            </span>
          </>
        )}

        {sold && (
          <span className="absolute top-2 end-2 z-20">
            <SoldBadge />
          </span>
        )}

        <FavoriteButton
          slug={listing.slug}
          listingId={listing.id}
          compact
          className="absolute top-2 start-2 z-30"
          snapshot={{
            model: title,
            year: listing.year,
            priceIRR: listing.priceIRR,
            ...(listing.coverUrl ? { coverUrl: listing.coverUrl } : {}),
          }}
        />

      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {/* Fixed badge slot: a card with no plate/report pill keeps the same
            title baseline as its neighbours. Badges stay on one compact row
            even in the phone 2-column grid — never a second line of pills. */}
        <div className="flex min-h-[24px] flex-nowrap items-center gap-1 overflow-hidden">
          {part && (
            <span className="shrink-0 whitespace-nowrap rounded-full border border-line bg-page px-2 py-0.5 text-[10px] font-bold text-muted sm:text-[11px]">
              {t(PART_CONDITION_LABELS[part.condition])}
            </span>
          )}
          {cardBadges(listing).map((b) => (
            <Badge key={b} badgeKey={b} />
          ))}
        </div>

        {part ? (
          <div className="min-h-[48px]">
            <h3
              className="line-clamp-2 text-sm font-extrabold leading-tight sm:text-base"
              style={sold ? { color: SOLD_TEXT } : undefined}
            >
              {title}
            </h3>
          </div>
        ) : (
          <div className="flex min-h-[48px] min-w-0 flex-col items-start text-right">
            {/* Latin marque first, on the same start edge as the model: the
                <bdi dir="ltr"> keeps the word unshuffled without floating the
                whole line to the opposite corner of an RTL card. */}
            {latin && (
              <p className="max-w-full truncate text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
                <bdi dir="ltr">{latin}</bdi>
              </p>
            )}
            <h3
              className="line-clamp-2 text-sm font-extrabold leading-tight sm:text-base"
              style={sold ? { color: SOLD_TEXT } : undefined}
            >
              <bdi>{title}</bdi>{' '}
              {listing.year > 0 && <span className="font-bold">{listing.year}</span>}
            </h3>
          </div>
        )}

        {/* No grey spec line on either breakpoint: mileage, gearbox, city and
            compatibility live on the listing detail page. Dropping it closes
            the title→price gap to the one 6px rhythm the card uses everywhere. */}
        <div className="w-full min-w-0 overflow-hidden">
          <PriceText irr={listing.priceIRR} sold={sold} hideAed={listing.hideAed} />
        </div>

        {/* Fixed seller slot from `sm` up: the verified pill, a seller name or
            an empty line all reserve the same height, so the footer aligns
            across the row. On phones the reservation is dropped, so no empty
            slot can sit between the price and the city row. */}
        <div className="flex flex-wrap content-start gap-1.5 sm:min-h-[28px]">
          {listing.showroomVerified ? (
            <VerifiedPill label={t(part ? 'تعمیرگاه معتبر' : 'نمایشگاه معتبر')} />
          ) : sellerName ? (
            <p className="w-full truncate text-xs font-bold text-muted">{sellerName}</p>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-line pt-2 text-xs text-faint">
          <span>{t(CITY_LABELS[listing.city] ?? listing.city)}</span>
          {/* Relative posting age stays desktop-only, where the footer has room. */}
          <time dateTime={listing.publishedAt ?? undefined} className="hidden sm:inline">
            {lang === 'en'
              ? postingAgeEnglish(listing.publishedAt ?? Date.now())
              : postingAgeLabel(listing.publishedAt ?? Date.now())}
          </time>
        </div>
      </div>

      {/* One stretched link: a tap anywhere on the card opens the listing,
          while the arrows, dots and bookmark stay above it and never navigate. */}
      <Link
        href={`/listing/${listing.slug}`}
        onClick={onLinkClick}
        aria-label={`${t('مشاهده‌ی آگهی', 'View listing')} ${title}${listing.year ? ` ${listing.year}` : ''}`}
        className="absolute inset-0 z-10 rounded-card"
      />
    </li>
  );
}

/**
 * A listing without a photo shows the neutral «No image» artwork — never a
 * borrowed stock car. The seller can add a cover later and the card updates.
 * The SVG is unoptimised on purpose: it is already a tiny vector.
 */
function NoImagePlaceholder() {
  return (
    <Image
      src="/placeholders/no-image.svg"
      alt="No image"
      fill
      sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 50vw"
      unoptimized
      className="object-cover"
    />
  );
}
