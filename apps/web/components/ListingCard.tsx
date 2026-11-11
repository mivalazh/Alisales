'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import { badgeFor, type BadgeKey } from '@studio/design';
import {
  CITY_LABELS,
  PART_CATEGORY_LABELS,
  PART_CONDITION_LABELS,
  PART_ORIGIN_LABELS,
  compatibilityLabel,
  postingAgeLabel,
} from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import { brandLatinFor, specParts, vehicleTitle } from '@/lib/listing-text';
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
const SWIPE_THRESHOLD = 36;

function Badge({ badgeKey }: { badgeKey: BadgeKey }) {
  const { t } = useI18n();
  const b = badgeFor(badgeKey);
  return (
    <span
      className="rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs font-bold"
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
  const specs = part ? [] : specParts(listing, lang);

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
      className="group relative flex h-full min-w-0 touch-manipulation flex-col overflow-hidden rounded-card border border-line bg-card transition hover:border-line-strong hover:shadow-lg active:scale-[0.98]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="relative aspect-[var(--photo-aspect)] bg-sunken">
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
              className="absolute start-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111144] shadow-md transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            >
              <Icon name="chevronRight" size={16} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t('عکس بعدی', 'Next photo')}
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
        {/* Fixed badge slot: a card with no plate/report pill keeps the same
            title baseline as its neighbours. */}
        <div className="flex min-h-[26px] flex-wrap content-start gap-1.5">
          {part && (
            <span className="rounded-[var(--radius-pill)] border border-line bg-page px-2 py-0.5 text-xs font-bold text-muted">
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

        <p
          className="line-clamp-1 min-h-[22px] text-[11px] leading-5 text-muted sm:text-xs"
          style={sold ? { color: SOLD_TEXT } : undefined}
        >
          {part ? (
            <>
              {t(PART_CATEGORY_LABELS[part.category])} · {t(PART_ORIGIN_LABELS[part.origin])} ·{' '}
              {lang === 'en' ? part.compatibility : compatibilityLabel(part.compatibility)}
            </>
          ) : (
            specs.map((item, i) => (
              <span key={`${item}-${i}`}>
                {i > 0 && <span className="mx-1 text-faint">·</span>}
                <bdi>{item}</bdi>
              </span>
            ))
          )}
        </p>

        {/* The price owns its own row, so the spec line above can never run
            into it and every card in a row lines up. */}
        <div className="w-full min-w-0 overflow-hidden pt-1">
          <PriceText irr={listing.priceIRR} sold={sold} hideAed={listing.hideAed} />
        </div>

        {/* Fixed seller slot: the verified pill, a seller name or an empty line
            all reserve the same height, so the city/date footer aligns across
            the whole row instead of drifting up on unverified cards. */}
        <div className="flex min-h-[28px] flex-wrap content-start gap-1.5">
          {listing.showroomVerified ? (
            <VerifiedPill label={t(part ? 'تعمیرگاه معتبر' : 'نمایشگاه معتبر')} />
          ) : sellerName ? (
            <p className="w-full truncate text-xs font-bold text-muted">{sellerName}</p>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-line pt-2 text-xs text-faint">
          <span>{t(CITY_LABELS[listing.city] ?? listing.city)}</span>
          <time dateTime={listing.publishedAt ?? undefined}>
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
