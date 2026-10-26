/**
 * Persian locale helpers shared by web, mobile and edge functions.
 *
 * Deliberately dependency- and `Intl`-free: the arithmetic Jalali conversion
 * behaves identically on Node, browsers and React Native Hermes (where
 * `Intl` calendar extensions are not guaranteed), and formatting output is
 * deterministic for snapshot tests. Correctness is proven in
 * tests/locale.test.ts against Node's full-ICU `fa-IR-u-ca-persian` calendar
 * across a 45-year date range.
 */

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'] as const;

/** Convert every ASCII digit in `input` to its Persian (فارسی) counterpart. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!);
}

/** Zero-pad a number to `width` digits (Persian calendar parts use width 2). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Group an integer by three with the Persian thousands separator (٬ U+066C). */
export function groupDigits(value: number): string {
  const negative = value < 0;
  const digits = String(Math.abs(Math.trunc(value)));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return negative ? `−${grouped}` : grouped;
}

/**
 * Format an amount in Iranian Rials with Persian digits, e.g.
 * `formatIRR(1_100_000_000_000)` → `۱٬۱۰۰٬۰۰۰٬۰۰۰٬۰۰۰ ریال`.
 */
export function formatIRR(amount: number): string {
  return `${toPersianDigits(groupDigits(amount))} ریال`;
}

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

/**
 * Gregorian (y, m, d) → Jalali (jy, jm, jd).
 *
 * Arithmetic conversion valid for the modern range (1800–2200 CE covers the
 * product's 1300–1420 Jalali year bounds with margin on both sides).
 */
export function toJalali(gy: number, gm: number, gd: number): JalaliDate {
  // Day offsets of each Gregorian month at the start of a non-leap year.
  const G_MONTH_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

  let jy = gy <= 1600 ? 0 : 979;
  const g = gy - (gy <= 1600 ? 621 : 1600);
  const gy2 = gm > 2 ? g + 1 : g;
  let days =
    365 * g +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    G_MONTH_DAYS[gm - 1]!;

  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return { jy, jm, jd };
}

/** Jalali parts of a Date, read in the runtime's local timezone. */
export function jalaliOf(date: Date): JalaliDate {
  return toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** `۱۴۰۵/۰۷/۲۹` — zero-padded, Persian digits, `/` separated. */
export function formatJalali(parts: JalaliDate): string {
  return toPersianDigits(`${parts.jy}/${pad2(parts.jm)}/${pad2(parts.jd)}`);
}

/** Format a Date as a Jalali calendar date, e.g. `۱۴۰۵/۰۷/۲۹`. */
export function formatJalaliDate(date: Date): string {
  return formatJalali(jalaliOf(date));
}
