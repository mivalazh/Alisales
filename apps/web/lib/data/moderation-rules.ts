import type { ListingCardData } from '../data/listings';

/**
 * Pure moderation rules — no storage, no React, no environment reads.
 *
 * Keeping the decisions here means the `/admin` queues and the public catalog
 * agree about what a moderation decision *means* (a hidden listing disappears,
 * an approved showroom gets the verified pill, an approved story is pinned)
 * and that behavior is unit-testable without a filesystem or a Supabase client.
 */

export type ReportDecision = 'open' | 'dismissed' | 'actioned';
export type VerificationDecision = 'pending' | 'approved' | 'rejected';
export type StoryDecision = 'pending' | 'approved' | 'rejected';

export interface ModerationState {
  /** report id → decision */
  reports: Record<string, ReportDecision>;
  /** account id (or sample key) → verification decision */
  verifications: Record<string, VerificationDecision>;
  /** listing slug → story decision */
  stories: Record<string, StoryDecision>;
  /** Listings an owner removed from the public catalog. */
  hidden: string[];
}

export function emptyModerationState(): ModerationState {
  return { reports: {}, verifications: {}, stories: {}, hidden: [] };
}

/** Normalizes a loosely-typed JSON read into a complete state (schema drift). */
export function normalizeModerationState(raw: Partial<ModerationState> | null | undefined): ModerationState {
  const base = emptyModerationState();
  if (!raw || typeof raw !== 'object') return base;
  const keep = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;
  const reports: Record<string, ReportDecision> = {};
  for (const [key, value] of Object.entries(raw.reports ?? {})) {
    reports[key] = keep(value, ['open', 'dismissed', 'actioned'] as const, 'open');
  }
  const verifications: Record<string, VerificationDecision> = {};
  for (const [key, value] of Object.entries(raw.verifications ?? {})) {
    verifications[key] = keep(value, ['pending', 'approved', 'rejected'] as const, 'pending');
  }
  const stories: Record<string, StoryDecision> = {};
  for (const [key, value] of Object.entries(raw.stories ?? {})) {
    stories[key] = keep(value, ['pending', 'approved', 'rejected'] as const, 'pending');
  }
  const hidden = Array.isArray(raw.hidden) ? raw.hidden.filter((id) => typeof id === 'string') : [];
  return { reports, verifications, stories, hidden };
}

export interface OverlayOptions {
  hidden: ReadonlySet<string> | readonly string[];
  verifiedSellers: ReadonlySet<string>;
}

/**
 * Applies moderation to a card feed:
 *  - removed listings never render,
 *  - an approved showroom's listings carry the verified pill even if the card
 *    row itself has not been updated yet,
 *  - `sold` listings are untouched (they still show, greyed, with the badge).
 */
export function applyModeration<T extends Pick<ListingCardData, 'id' | 'sellerId' | 'showroomVerified'>>(
  listings: readonly T[],
  options: OverlayOptions,
): T[] {
  const hidden = options.hidden instanceof Set ? options.hidden : new Set(options.hidden);
  return listings
    .filter((listing) => !hidden.has(listing.id))
    .map((listing) =>
      !listing.showroomVerified && options.verifiedSellers.has(listing.sellerId)
        ? { ...listing, showroomVerified: true }
        : listing,
    );
}

/** One-line platform health used by the overview cards. */
export function overviewCounts(listings: readonly ListingCardData[]): {
  activeVehicles: number;
  activeParts: number;
  sold: number;
} {
  let activeVehicles = 0;
  let activeParts = 0;
  let sold = 0;
  for (const listing of listings) {
    if (listing.state === 'sold') sold += 1;
    if (listing.state !== 'active') continue;
    if (listing.kind === 'part') activeParts += 1;
    else activeVehicles += 1;
  }
  return { activeVehicles, activeParts, sold };
}

