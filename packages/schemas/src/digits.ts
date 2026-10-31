/**
 * Digit rules (S2 / C8): every visible number — prices, years, mileage,
 * counters, relative dates — renders with Western/Latin digits (0–9).
 *
 * Input, however, may arrive in Persian (۰-۹) or Arabic-Indic (٠-٩) digits from
 * phone keyboards, so normalization happens on the way in and formatting
 * always emits ASCII.
 */

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Convert every Persian/Arabic-Indic digit in `value` to its ASCII digit. */
export function toLatinDigits(value: string): string {
  let out = '';
  for (const ch of value) {
    const fa = PERSIAN_DIGITS.indexOf(ch);
    if (fa >= 0) {
      out += String(fa);
      continue;
    }
    const ar = ARABIC_DIGITS.indexOf(ch);
    out += ar >= 0 ? String(ar) : ch;
  }
  return out;
}

/** Group an integer with ASCII thousands separators: 1250000 → "1,250,000". */
export function groupLatinDigits(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  const rounded = Math.trunc(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = String(Math.abs(rounded));
  let grouped = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += ',';
    grouped += digits[i];
  }
  return sign + grouped;
}

/** Plain amount, Latin digits, no currency: 1250000 → "1,250,000". */
export function formatAmountLatin(amount: number): string {
  return groupLatinDigits(amount);
}

/** Price with the ریال unit, Latin digits: 1250000 → "1,250,000 ریال". */
export function formatPriceLatin(amount: number): string {
  return `${groupLatinDigits(amount)} ریال`;
}
