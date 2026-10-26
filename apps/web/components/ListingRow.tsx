import Image from 'next/image';
import Link from 'next/link';
import { badgeFor, type BadgeKey } from '@studio/design';
import {
  CITY_LABELS,
  GEARBOX_LABELS,
  formatIRR,
  formatJalaliDate,
  groupDigits,
  toPersianDigits,
} from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';

const STATE_BADGE: Record<ListingCardData['state'], BadgeKey> = {
  draft: 'draft',
  pending_review: 'pending_review',
  active: 'active',
  paused: 'paused',
  sold: 'sold',
  expired: 'expired',
  rejected: 'rejected',
};

/** Compact list-view row — same data as the grid card, one horizontal line-up. */
export function ListingRow({ listing }: { listing: ListingCardData }) {
  const published = new Date(listing.publishedAt ?? Date.now());
  const sold = listing.state === 'sold';

  return (
    <li className="overflow-hidden rounded-card border border-line bg-card transition hover:border-line-strong hover:shadow-lg">
      <Link href={`/listing/${listing.slug}`} className="flex items-stretch gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-field bg-sunken sm:w-32">
          {listing.coverUrl ? (
            <Image
              src={listing.coverUrl}
              alt={`${listing.model} ${listing.year}`}
              fill
              sizes="128px"
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
                className="rounded-[var(--radius-pill)] border px-2 py-0.5 text-xs font-bold"
                style={{
                  background: badgeFor('sold').background,
                  color: badgeFor('sold').foreground,
                  borderColor: badgeFor('sold').border,
                }}
              >
                {badgeFor('sold').label}
              </span>
            )}
            {listing.featured && (
              <span className="rounded-[var(--radius-pill)] bg-cta px-2 py-0.5 text-xs font-extrabold text-ink">
                ویژه
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

          <h3 className="truncate text-sm font-extrabold leading-tight sm:text-base">
            {listing.model}
            {listing.trim ? ` ${listing.trim}` : ''}{' '}
            <span className="font-bold text-muted">{toPersianDigits(listing.year)}</span>
          </h3>

          <p className="truncate text-xs text-muted">
            {toPersianDigits(groupDigits(listing.mileageKm))} کیلومتر ·{' '}
            {GEARBOX_LABELS[listing.gearbox]} · {CITY_LABELS[listing.city] ?? listing.city}
          </p>

          <div className="mt-auto flex items-center justify-between gap-2">
            <p className={`text-sm font-extrabold sm:text-base ${sold ? 'text-muted' : 'text-ink'}`}>
              {formatIRR(listing.priceIRR)}
            </p>
            <time
              dateTime={published.toISOString()}
              className="text-xs text-faint"
            >
              {formatJalaliDate(published)}
            </time>
          </div>
        </div>
      </Link>
    </li>
  );
}
