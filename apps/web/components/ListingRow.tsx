'use client';

import Image from 'next/image';
import Link from 'next/link';
import { badgeFor, type BadgeKey } from '@studio/design';
import { postingAgeLabel } from '@alisales/schemas';
import type { ReactNode } from 'react';
import type { ListingCardData } from '@/lib/data/listings';
import { brandLatinFor, vehicleTitle } from '@/lib/listing-text';
import { useI18n } from '@/lib/i18n';
import { translateListingContentToEn } from '@/lib/i18n/content';
import { postingAgeEnglish } from '@/lib/i18n/dictionary';
import { FavoriteButton } from './FavoriteButton';
import { PriceText } from './PriceText';
import { VerifiedPill } from './SellerVerified';
import { SoldBadge } from './SoldBadge';
import { Icon } from './Icon';
import { isPreSizedSource } from '@/lib/images';

const SOLD_TEXT = '#64748B';

const STATE_BADGE: Record<Exclude<ListingCardData['state'], 'sold'>, BadgeKey> = {
  draft: 'draft',
  pending_review: 'pending_review',
  active: 'active',
  paused: 'paused',
  expired: 'expired',
  rejected: 'rejected',
};

/** Compact list-view row — same rules as the grid card (C8). */
export function ListingRow({
  listing,
  actions,
}: {
  listing: ListingCardData;
  /** Owner-only row actions («آگهی‌های من»); omitted in public lists. */
  actions?: ReactNode;
}) {
  const { lang, t } = useI18n();
  const sold = listing.state === 'sold';
  const part = listing.part ?? null;
  const latin = part ? null : brandLatinFor(listing.brand);
  const rawTitle = part ? part.title : vehicleTitle(listing);
  const title = lang === 'en' ? translateListingContentToEn(rawTitle) : rawTitle;
  const hasPhoto = Boolean(
    listing.coverUrl && !/no-image|placeholder/i.test(listing.coverUrl),
  );

  return (
    <li className="relative min-w-0 overflow-hidden rounded-card border border-line bg-card transition hover:border-line-strong hover:shadow-lg">
      <Link href={`/listing/${listing.slug}`} className="relative flex items-stretch gap-3 p-3 sm:gap-4 sm:p-4">
        {/* Strict square frame: the photo fills the whole slot edge to edge,
            so no grey strip can appear under a short or stretched image. */}
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-sunken">
          {hasPhoto && listing.coverUrl ? (
            <Image
              src={listing.coverUrl}
              alt={part ? title : `${translateListingContentToEn(listing.model)} ${listing.year}`}
              fill
              sizes="96px"
              unoptimized={isPreSizedSource(listing.coverUrl)}
              loading="lazy"
              decoding="async"
              className={`h-full w-full object-cover ${sold ? 'opacity-60 grayscale' : ''}`}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-faint">
              <Icon name="imageX" size={24} />
              <span className="text-[10px] font-bold">{t('بدون عکس', 'No photo')}</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {sold && <SoldBadge />}
            {listing.state !== 'active' && listing.state !== 'sold' && (
              <span
                className="rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs font-bold"
                style={{
                  background: badgeFor(STATE_BADGE[listing.state]).background,
                  color: badgeFor(STATE_BADGE[listing.state]).foreground,
                  borderColor: badgeFor(STATE_BADGE[listing.state]).border,
                }}
              >
                {t(badgeFor(STATE_BADGE[listing.state]).label)}
              </span>
            )}
            {listing.showroomVerified && (
              <VerifiedPill label={t(part ? 'تعمیرگاه معتبر' : 'نمایشگاه معتبر')} />
            )}
          </div>

          {!part && latin && (
            <p className="max-w-full truncate text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
              <bdi dir="ltr">{latin}</bdi>
            </p>
          )}

          <h3
            className="truncate text-sm font-extrabold leading-tight sm:text-base"
            style={sold ? { color: SOLD_TEXT } : undefined}
          >
            {part ? (
              title
            ) : (
              <>
                <bdi>{vehicleTitle(listing)}</bdi>{' '}
                {listing.year > 0 && <span className="font-bold">{listing.year}</span>}
              </>
            )}
          </h3>

          {/* The spec/city line is gone here too: full specs live on the
              detail page, so the title runs straight into the price with the
              row's own 6px rhythm. */}
          <div className="mt-auto flex items-end justify-between gap-2 pe-16">
            <PriceText irr={listing.priceIRR} sold={sold} hideAed={listing.hideAed} />
          </div>
        </div>
        <time
          dateTime={listing.publishedAt ?? undefined}
          className="absolute bottom-3 left-3 text-[11px] font-medium text-slate-400"
        >
          {lang === 'en'
            ? postingAgeEnglish(listing.publishedAt ?? Date.now())
            : postingAgeLabel(listing.publishedAt ?? Date.now())}
        </time>
      </Link>
      <FavoriteButton
        slug={listing.slug}
        listingId={listing.id}
        compact
        className="absolute top-3 start-3 z-10"
        snapshot={{
          model: part ? part.title : `${listing.model}${listing.trim ? ` ${listing.trim}` : ''}`,
          year: listing.year,
          priceIRR: listing.priceIRR,
          ...(listing.coverUrl ? { coverUrl: listing.coverUrl } : {}),
        }}
      />
      {actions && <div className="border-t border-line px-3 py-2 sm:px-4">{actions}</div>}
    </li>
  );
}
