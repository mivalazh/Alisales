/**
 * «قیمت به حروف» — a typed amount read back in Persian words.
 *
 * Sellers type eleven-digit prices by hand, and a wrong zero is invisible in a
 * run of digits. The form prints «۵۴ میلیارد و ۴۰۰ میلیون تومان» under the
 * field, so the number is checked by eye before it is published.
 *
 * Grouped-digit form (not spelled-out words) keeps the helper short enough for
 * one line, still in Persian digits like every visible number on the platform.
 */

const SCALES = ['', 'هزار', 'میلیون', 'میلیارد', 'هزار میلیارد'] as const;

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** 54400000000 → "۵۴۴۰۰۰۰۰۰۰۰". */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS.charAt(Number(d)));
}

/**
 * Amount in grouped Persian words: 54400000000 → «۵۴ میلیارد و ۴۰۰ میلیون».
 * Zero, negatives and non-finite input read as an empty string.
 */
export function amountToPersianWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '';
  const rounded = Math.trunc(amount);
  if (rounded <= 0) return '';

  const groups: number[] = [];
  let rest = rounded;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i] ?? 0;
    if (group === 0) continue;
    const scale = SCALES[i] ?? '';
    // «۱ میلیون» is correct, but «۱ هزار» reads as «هزار».
    if (group === 1 && scale) parts.push(scale);
    else parts.push(scale ? `${toPersianDigits(group)} ${scale}` : toPersianDigits(group));
  }

  return parts.join(' و ');
}

/**
 * Live helper line for a price field: «۵۴ میلیارد و ۴۰۰ میلیون تومان».
 * A too-large amount still reads back, it just stops at «هزار میلیارد».
 */
export function tomanInWords(toman: number): string {
  const words = amountToPersianWords(toman);
  return words ? `${words} تومان` : '';
}
