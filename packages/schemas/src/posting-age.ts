/**
 * Posting age shown on listing cards and detail pages.
 *
 * Product rules (S2):
 *  - Relative and rounded. Never a Jalali date, never hours.
 *  - Day boundaries are the Jalali calendar day in Asia/Tehran — NOT a rolling
 *    24-hour window. A listing posted at 23:50 and viewed at 00:10 the next
 *    Tehran day reads «دیروز» even though only 20 minutes passed.
 *  - Editing a listing never changes its posting age, so every function here
 *    takes the publication instant only (never updated_at).
 *  - All numbers are Western digits: "3 روز پیش", never "۳ روز پیش".
 *
 * Timezone: Iran has observed no daylight saving since 2022 and runs on a
 * fixed +03:30 offset, so a constant offset reproduces Asia/Tehran midnight
 * boundaries exactly. Beyond 360 days every listing collapses into
 * «بیش از یک سال پیش», so the pre-2022 DST era can never affect a label.
 */

/** Fixed Iran Standard Time offset (+03:30), in milliseconds. */
export const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

const DAY_MS = 86_400_000;

/** Accept a Date, an epoch-ms number or an ISO timestamp string. */
function toMillis(instant: Date | number | string): number {
  const ms =
    instant instanceof Date
      ? instant.getTime()
      : typeof instant === 'string'
        ? Date.parse(instant)
        : instant;
  if (!Number.isFinite(ms)) {
    throw new RangeError(`posting_age: invalid date (${String(instant)})`);
  }
  return ms;
}

/**
 * Serial number of the Tehran calendar day containing `instant`.
 * Two instants share a value exactly when they fall on the same Tehran day.
 */
export function tehranDayIndex(instant: Date | number | string): number {
  return Math.floor((toMillis(instant) + TEHRAN_OFFSET_MS) / DAY_MS);
}

/**
 * Whole Tehran calendar days between publication and `now` (never negative:
 * a clock-skewed future timestamp reads as today).
 */
export function postingAgeDays(
  publishedAt: Date | number | string,
  now: Date | number | string = Date.now(),
): number {
  return Math.max(0, tehranDayIndex(now) - tehranDayIndex(publishedAt));
}

/**
 * Persian posting-age label for a listing card or detail page:
 * امروز · دیروز · N روز پیش · یک هفته پیش · 2 هفته پیش · 3 هفته پیش ·
 * یک ماه پیش · 2 ماه پیش · N ماه پیش · بیش از یک سال پیش
 */
export function postingAgeLabel(
  publishedAt: Date | number | string,
  now: Date | number | string = Date.now(),
): string {
  const days = postingAgeDays(publishedAt, now);

  if (days <= 0) return 'امروز';
  if (days === 1) return 'دیروز';
  if (days <= 6) return `${days} روز پیش`;
  if (days <= 13) return 'یک هفته پیش';
  if (days <= 20) return '2 هفته پیش';
  if (days <= 27) return '3 هفته پیش';
  if (days <= 59) return 'یک ماه پیش';
  if (days <= 89) return '2 ماه پیش';

  // Whole 30-day months up to one year, then a single floor label.
  const months = Math.floor(days / 30);
  if (months >= 12) return 'بیش از یک سال پیش';
  return `${months} ماه پیش`;
}
