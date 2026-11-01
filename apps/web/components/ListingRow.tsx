import Image from 'next/image';
import Link from 'next/link';
import { badgeFor, type BadgeKey } from '@studio/design';
import {
  CITY_LABELS,
  GEARBOX_LABELS,
  PART_CATEGORY_LABELS,
  PART_ORIGIN_LABELS,
  postingAgeLabel,
} from '@alisales/schemas';
import type { ReactNode } from 'react';
import type { ListingCardData } from '@/lib/data/listings';
import { PriceText } from './PriceText';

const SOLD_BG = '#F98513';
const SOLD_INK = '#111144';
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
  const sold = listing.state === 'sold';
  const part = listing.part ?? null;

  return (
    <li className="overflow-hidden rounded-card border border-line bg-card transition hover:border-line-strong hover:shadow-lg">
      <Link href={`/listing/${listing.slug}`} className="flex items-stretch gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-field bg-sunken sm:w-32">
          {listing.coverUrl ? (
            <Image
              src={listing.coverUrl}
              alt={part ? part.title : `${listing.model} ${listing.year}`}
              fill
              sizes="128px"
              unoptimized={listing.coverUrl.endsWith('.svg')}
              className={`object-cover ${sold ? 'opacity-60 grayscale' : ''}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-faint">
              <svg
                aria-hidden="true"
                width="24"
                height="24"
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
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {sold && (
              <span
                className="px-2 py-0.5 text-xs font-extrabold"
                style={{ background: SOLD_BG, color: SOLD_INK, borderRadius: 8 }}
              >
                Sold
              </span>
            )}
            {listing.state !== 'active' && listing.state !== 'sold' && (
              <span
                className="rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs font-bold"
                style={{
                  background: badgeFor(STATE_BADGE[listing.state]).background,
                  color: badgeFor(STATE_BADGE[listing.state]).foreground,
                  borderColor: badgeFor(STATE_BADGE[listing.state]).border,
                }}
              >
                {badgeFor(STATE_BADGE[listing.state]).label}
              </span>
            )}
            {listing.hasReport && (
              <span
                className="rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs font-bold"
                style={{
                  background: badgeFor('verified_report').background,
                  color: badgeFor('verified_report').foreground,
                  borderColor: badgeFor('verified_report').border,
                }}
              >
                {badgeFor('verified_report').label}
              </span>
            )}
          </div>

          <h3
            className="truncate text-sm font-extrabold leading-tight sm:text-base"
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

          <p className="truncate text-xs text-muted" style={sold ? { color: SOLD_TEXT } : undefined}>
            {part ? (
              <>
                {PART_CATEGORY_LABELS[part.category]} · {PART_ORIGIN_LABELS[part.origin]} ·{' '}
                {CITY_LABELS[listing.city] ?? listing.city}
              </>
            ) : (
              <>
                {listing.mileageKm} کیلومتر · {GEARBOX_LABELS[listing.gearbox]} ·{' '}
                {CITY_LABELS[listing.city] ?? listing.city}
              </>
            )}
          </p>

          <div className="mt-auto flex items-center justify-between gap-2">
            <PriceText irr={listing.priceIRR} sold={sold} />
            <time dateTime={listing.publishedAt ?? undefined} className="text-xs text-faint">
              {postingAgeLabel(listing.publishedAt ?? Date.now())}
            </time>
          </div>
        </div>
      </Link>
      {actions && <div className="border-t border-line px-3 py-2 sm:px-4">{actions}</div>}
    </li>
  );
}
