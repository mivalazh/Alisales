import { badgeTag, statusTag } from './tokens';

/**
 * Status badge registry — the visual language of Alisales.
 *
 * Every badge (five core product tags + seven lifecycle states) renders a
 * `statusTag` pair from tokens.ts — colors may never be invented here.
 * The 1px border uses the same color as the tag text (approved decision).
 * Colors are locked by tests/status.test.ts; do not change without review.
 *
 * Rendering rule (Phase 2 / D2): a sold listing keeps its `sold` badge in the
 * catalog — buyers see it sorts last but the listing stays reachable. Use
 * lifecycleTagFor(state) to resolve which lifecycle badge (if any) to render.
 */
export const badgeKeys = [
  // Core product badges
  'new',
  'used',
  'kish_plate',
  'temporary_transit',
  'verified_report',
  // Listing lifecycle
  'draft',
  'pending_review',
  'active',
  'paused',
  'sold',
  'expired',
  'rejected',
] as const;

export type BadgeKey = (typeof badgeKeys)[number];

/** The five core badges required by the product spec. */
export const CORE_BADGES = [
  'new',
  'used',
  'kish_plate',
  'temporary_transit',
  'verified_report',
] as const satisfies readonly BadgeKey[];

/** Listing lifecycle states — order mirrors the schema's ListingState. */
export const LIFECYCLE_STATES = [
  'draft',
  'pending_review',
  'active',
  'paused',
  'sold',
  'expired',
  'rejected',
] as const satisfies readonly BadgeKey[];

export type ListingLifecycleState = (typeof LIFECYCLE_STATES)[number];

export interface BadgeToken {
  key: BadgeKey;
  /** Persian label. */
  label: string;
  background: string;
  foreground: string;
  border: string;
  /** Icon token name — apps map it to the shared icon registry. */
  icon: string;
  tone: 'core' | 'lifecycle';
}

function badge(
  key: BadgeKey,
  label: string,
  icon: string,
  tone: 'core' | 'lifecycle',
): BadgeToken {
  const pair = statusTag[badgeTag[key]];
  return {
    key,
    label,
    background: pair.bg,
    foreground: pair.text,
    border: pair.text, // 1px border = tag text color (approved)
    icon,
    tone,
  };
}

export const STATUS_BADGES: Record<BadgeKey, BadgeToken> = {
  new: badge('new', 'نو', 'sparkle', 'core'),
  used: badge('used', 'کارکرده', 'car', 'core'),
  kish_plate: badge('kish_plate', 'پلاک کیش', 'plate', 'core'),
  temporary_transit: badge('temporary_transit', 'گذر موقت', 'clock', 'core'),
  verified_report: badge('verified_report', 'گزارش تاییدشده', 'badgeCheck', 'core'),
  draft: badge('draft', 'پیش‌نویس', 'pencil', 'lifecycle'),
  pending_review: badge('pending_review', 'در انتظار بررسی', 'hourglass', 'lifecycle'),
  active: badge('active', 'فعال', 'checkCircle', 'lifecycle'),
  paused: badge('paused', 'متوقف', 'pauseCircle', 'lifecycle'),
  // Label is English by final product decision (D2); color pair is the
  // existing `transit` pair (see badgeTag in tokens.ts).
  sold: badge('sold', 'Sold', 'tag', 'lifecycle'),
  expired: badge('expired', 'منقضی', 'calendarX', 'lifecycle'),
  rejected: badge('rejected', 'رد شده', 'xCircle', 'lifecycle'),
};

export function badgeFor(key: BadgeKey): BadgeToken {
  return STATUS_BADGES[key];
}

/**
 * Which lifecycle badge a listing state renders — `null` means NO lifecycle tag.
 *
 * Phase 2 / D2: `sold` maps to its own badge (English label "Sold", transit
 * color pair) — sold listings stay in the catalog with the badge visible.
 * Every state maps to its own badge; the null return stays for API stability.
 */
export function lifecycleTagFor(
  state: ListingLifecycleState,
): BadgeKey | null {
  return state;
}

/** Plate values accepted by tagsForListing (mirrors the schema's PlateType). */
export type ListingPlateType = 'standard' | 'kish' | 'temporary_transit' | 'unplated';

/**
 * Tags shown on a listing card — max two, fixed semantics:
 *
 *   - condition first as the baseline (`new` / `used`).
 *   - a plate tag OVERRIDES the condition when plateType ≠ standard:
 *       standard          → [condition]                (exactly one tag;
 *                              verified_report is suppressed here)
 *       kish              → [kish_plate]               (+ report if present)
 *       transit / unplated→ [temporary_transit]        (+ report if present)
 *   - verified_report is appended ONLY when a plate tag exists (max 2 total).
 *
 * Lifecycle-state badges are rendered separately by the apps (see STATE_BADGE
 * mappings in web/mobile), not through this helper — resolved via
 * lifecycleTagFor(state). Every tag this helper can return is one of the five
 * approved core badges; the sold badge is added by the app on top of them.
 */
export function tagsForListing(
  condition: 'new' | 'used',
  plateType: ListingPlateType,
  hasReport: boolean,
): BadgeKey[] {
  const conditionTag: BadgeKey = condition === 'new' ? 'new' : 'used';

  const plateTag: BadgeKey | null =
    plateType === 'kish'
      ? 'kish_plate'
      : plateType === 'temporary_transit' || plateType === 'unplated'
        ? 'temporary_transit'
        : null;

  if (!plateTag) return [conditionTag];
  return hasReport ? [plateTag, 'verified_report'] : [plateTag];
}
