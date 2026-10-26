import Image from 'next/image';
import Link from 'next/link';
import { badgeFor, type BadgeKey } from '@studio/design';
import {
  CITY_LABELS,
  GEARBOX_LABELS,
  PLATE_TYPE_LABELS,
  formatIRR,
  formatJalaliDate,
  groupDigits,
  toPersianDigits,
} from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';

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

/** Lifecycle states render their design badge (all map 1:1 to badge keys). */
const STATE_BADGE: Record<ListingCardData['state'], BadgeKey> = {
  draft: 'draft',
  pending_review: 'pending_review',
  active: 'active',
  paused: 'paused',
  sold: 'sold',
  expired: 'expired',
  rejected: 'rejected',
};

/** Badge + core tags for a listing — shared by the grid card and the row. */
function cardBadges(listing: ListingCardData): BadgeKey[] {
  const badges: BadgeKey[] = [];
  if (listing.state !== 'active') badges.push(STATE_BADGE[listing.state]);
  badges.push(listing.condition === 'new' ? 'new' : 'used');
  const plate = plateBadgeKey(listing.plateType);
  if (plate) badges.push(plate);
  if (listing.hasReport) badges.push('verified_report');
  return badges;
}

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const published = new Date(listing.publishedAt ?? Date.now());
  const sold = listing.state === 'sold';

  return (
    <li className="overflow-hidden rounded-card border border-line bg-card transition hover:border-line-strong hover:shadow-lg">
      <Link href={`/listing/${listing.slug}`} className="block">
        <div className="relative aspect-[var(--photo-aspect)] bg-sunken">
          {listing.coverUrl ? (
            <Image
              src={listing.coverUrl}
              alt={`${listing.model} ${listing.year}`}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className={`object-cover ${sold ? 'opacity-60 grayscale' : ''}`}
            />
          ) : (
            <CameraPlaceholder />
          )}
          {listing.featured && (
            <span className="absolute top-2 end-2 rounded-[var(--radius-pill)] bg-cta px-2.5 py-0.5 text-xs font-extrabold text-ink">
              ویژه
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 p-3 sm:p-4">
          <div className="flex flex-wrap gap-1.5">
            {cardBadges(listing).map((b) => (
              <Badge key={b} badgeKey={b} />
            ))}
          </div>

          <h3 className="text-base font-extrabold leading-tight">
            {listing.model}
            {listing.trim ? ` ${listing.trim}` : ''}{' '}
            <span className="font-bold text-muted">{toPersianDigits(listing.year)}</span>
          </h3>

          <p className="text-xs text-muted">
            {toPersianDigits(groupDigits(listing.mileageKm))} کیلومتر ·{' '}
            {GEARBOX_LABELS[listing.gearbox]} · {PLATE_TYPE_LABELS[listing.plateType]}
          </p>

          <p className={`text-lg font-extrabold ${sold ? 'text-muted' : 'text-ink'}`}>
            {formatIRR(listing.priceIRR)}
          </p>

          {listing.showroomName && (
            <p className="flex items-center gap-1 text-xs font-bold text-note">
              {listing.showroomName}
              {listing.showroomVerified && (
                <>
                  <VerifiedMark />
                  <span>نمایشگاه معتبر</span>
                </>
              )}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between border-t border-line pt-2 text-xs text-faint">
            <span>{CITY_LABELS[listing.city] ?? listing.city}</span>
            <time dateTime={published.toISOString()}>{formatJalaliDate(published)}</time>
          </div>
        </div>
      </Link>
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

function VerifiedMark() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-note"
    >
      <path d="M12 2l2.4 1.8 3-.3 1 2.8 2.6 1.5-.9 2.9.9 2.9-2.6 1.5-1 2.8-3-.3L12 22l-2.4-1.8-3 .3-1-2.8L3 16.2l.9-2.9L3 10.4l2.6-1.5 1-2.8 3 .3z" />
      <path
        d="M8.5 12.2l2.3 2.3 4.7-4.8"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
