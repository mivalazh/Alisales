import { tokens } from './tokens';

/**
 * Status badge registry — the visual language of Alisales.
 * Each badge has a fixed background/foreground/border and an icon token.
 * Colors are locked by tests/status.test.ts; do not change without review.
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

export interface BadgeToken {
  key: BadgeKey;
  /** Persian label. */
  label: string;
  background: string;
  foreground: string;
  border: string;
  /** Icon token name — apps map it to their icon set. */
  icon: string;
  tone: 'core' | 'lifecycle';
}

function badge(
  key: BadgeKey,
  label: string,
  icon: string,
  tone: 'core' | 'lifecycle',
): BadgeToken {
  return {
    key,
    label,
    background: tokens[`color-badge-${key}-bg`],
    foreground: tokens[`color-badge-${key}-fg`],
    border: tokens[`color-badge-${key}-border`],
    icon,
    tone,
  };
}

export const STATUS_BADGES: Record<BadgeKey, BadgeToken> = {
  new: badge('new', 'نو', 'sparkle', 'core'),
  used: badge('used', 'کارکرده', 'odometer', 'core'),
  kish_plate: badge('kish_plate', 'پلاک کیش', 'plate', 'core'),
  temporary_transit: badge('temporary_transit', 'گذر موقت', 'clock', 'core'),
  verified_report: badge('verified_report', 'گزارش تأییدشده', 'badge-check', 'core'),
  draft: badge('draft', 'پیش‌نویس', 'pencil', 'lifecycle'),
  pending_review: badge('pending_review', 'در انتظار بررسی', 'hourglass', 'lifecycle'),
  active: badge('active', 'فعال', 'check-circle', 'lifecycle'),
  paused: badge('paused', 'متوقف', 'pause-circle', 'lifecycle'),
  sold: badge('sold', 'فروخته‌شده', 'tag', 'lifecycle'),
  expired: badge('expired', 'منقضی', 'calendar-x', 'lifecycle'),
  rejected: badge('rejected', 'رد شده', 'x-circle', 'lifecycle'),
};

export function badgeFor(key: BadgeKey): BadgeToken {
  return STATUS_BADGES[key];
}
