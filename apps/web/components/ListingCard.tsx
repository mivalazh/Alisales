'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import { badgeFor, type BadgeKey } from '@studio/design';
import {
  CITY_LABELS,
  GEARBOX_LABELS,
  PART_CATEGORY_LABELS,
  PART_ORIGIN_LABELS,
  PLATE_TYPE_LABELS,
  compatibilityLabel,
  postingAgeLabel,
} from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import { FavoriteButton } from './FavoriteButton';
import { Icon } from './Icon';
import { PriceText } from './PriceText';
import { SoldBadge } from './SoldBadge';
import { VerifiedPill, sellerDisplayName } from './SellerVerified';
import { isPreSizedSource } from '@/lib/images';

/** Sold text tone — muted so the carmine badge carries the emphasis. */
const SOLD_TEXT = '#64748B';
/** Horizontal travel (px) that counts as a photo swipe rather than a tap. */
const SWIPE_THRESHOLD = 36;

function Badge({ badgeKey }: { badgeKey: BadgeKey }) {
  const b = badgeFor(badgeKey);
  return (
    <span
      className="rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs font-bold"
      style={{ background: b.background, color: b.foreground, borderColor: b.border }}
    >
      {b.label}
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
  badges.push(listing.condition === 'new' ? 'new' : 'used');
  const plate = listing.part ? null : plateBadgeKey(listing.plateType);
  if (plate) badges.push(plate);
  if (listing.hasReport) badges.push('verified_report');
  return badges;
}

/**
 * Catalog card. Posting age is relative text on Tehran calendar days (C8);
 * year, mileage and price always render with Latin digits.
 *
 * The cover frame is browsable before the detail page: arrows step through the
 * gallery, touch devices swipe, and a counter shows where you are. The heart
 * sits in the photo's top-start corner (top-right in RTL) and the whole card is
 * covered by one stretched link, so a tap anywhere opens the listing. Arrow and
 * heart stay above that link and never navigate.
 */
export function ListingCard({ listing }: { listing: ListingCardData }) {
  const sold = listing.state === 'sold';
  const part = listing.part ?? null;
  const title = part ? part.title : `${listing.model}${listing.trim ? ` ${listing.trim}` : ''}`;
  const sellerName = sellerDisplayName(listing.showroomName);

  const photos = listing.photos?.length
    ? listing.photos
    : listing.coverUrl
      ? [listing.coverUrl]
      : [];
  const count = photos.length;
  const [index, setIndex] = useState(0);
  const current = photos[index] ?? null;
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);

  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  const onTouchStart = (event: TouchEvent<HTMLLIElement>) => {
    touchX.current = event.touches[0]?.clientX ?? null;
    swiped.current = false;
  };

  const onTouchEnd = (event: TouchEvent<HTMLLIElement>) => {
    const start = touchX.current;
    const end = event.changedTouches[0]?.clientX;
    touchX.current = null;
    if (start === null || end === undefined || count < 2) return;
    const dx = end - start;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
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
      className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-card transition hover:border-line-strong hover:shadow-lg"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative aspect-[var(--photo-aspect)] bg-sunken">
        {current ? (
          <Image
            src={current}
            alt={part ? part.title : `${listing.model} ${listing.year}`}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 50vw"
            unoptimized={isPreSizedSource(current)}
            className={`object-cover ${sold ? 'opacity-60 grayscale' : ''}`}
          />
        ) : (
          <CameraPlaceholder />
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="عکس قبلی"
              className="absolute start-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111144] shadow-md transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            >
              <Icon name="chevronRight" size={16} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="عکس بعدی"
              className="absolute end-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111144] shadow-md transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            >
              <Icon name="chevronLeft" size={16} />
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

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {cardBadges(listing).map((b) => (
            <Badge key={b} badgeKey={b} />
          ))}
        </div>

        <h3
          className="text-base font-extrabold leading-tight"
          style={sold ? { color: SOLD_TEXT } : undefined}
        >
          {part ? (
            part.title
          ) : (
            <>
              {listing.model}
              {listing.trim ? ` ${listing.trim}` : ''}{' '}
              <span className="font-bold">{listing.year}</span>
            </>
          )}
        </h3>

        <p className="text-xs text-muted" style={sold ? { color: SOLD_TEXT } : undefined}>
          {part ? (
            <>
              {PART_CATEGORY_LABELS[part.category]} · {PART_ORIGIN_LABELS[part.origin]} ·{' '}
              {compatibilityLabel(part.compatibility)}
            </>
          ) : (
            <>
              {listing.mileageKm} کیلومتر · {GEARBOX_LABELS[listing.gearbox]} ·{' '}
              {PLATE_TYPE_LABELS[listing.plateType]}
            </>
          )}
        </p>

        <PriceText irr={listing.priceIRR} sold={sold} hideAed={listing.hideAed} />

        {/* Verified sellers show the standardized pill only; the old
            «اتومبیل کیش •» label never prints again. */}
        {listing.showroomVerified ? (
          <div className="flex flex-wrap gap-1.5">
            <VerifiedPill label={part ? 'تعمیرگاه معتبر' : 'نمایشگاه معتبر'} />
          </div>
        ) : sellerName ? (
          <p className="truncate text-xs font-bold text-muted">{sellerName}</p>
        ) : null}

        <div className="mt-auto flex items-center justify-between border-t border-line pt-2 text-xs text-faint">
          <span>{CITY_LABELS[listing.city] ?? listing.city}</span>
          <time dateTime={listing.publishedAt ?? undefined}>
            {postingAgeLabel(listing.publishedAt ?? Date.now())}
          </time>
        </div>
      </div>

      {/* One stretched link: a tap anywhere on the card opens the listing,
          while the arrows, dots and heart stay above it and never navigate. */}
      <Link
        href={`/listing/${listing.slug}`}
        onClick={onLinkClick}
        aria-label={`مشاهده‌ی آگهی ${title}${listing.year ? ` ${listing.year}` : ''}`}
        className="absolute inset-0 z-10 rounded-card"
      />
    </li>
  );
}

function CameraPlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-faint">
      <svg
        aria-hidden="true"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
      <span className="text-xs">بدون عکس</span>
    </div>
  );
}
