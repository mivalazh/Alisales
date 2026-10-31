import { toLatinDigits } from './digits';

/**
 * Iranian mobile numbers (S2 login).
 *
 * Canonical form is always the local 11-digit `09xxxxxxxxx` string: it is what
 * we store, hash for OTP lookups and show back to the user. Input is tolerated
 * in Persian/Arabic digits, with spaces, dashes, parentheses, and with the
 * +98 / 0098 / 98 country-code prefixes.
 */

const MOBILE = /^09\d{9}$/;

/** Strip formatting and country prefixes; digits are always Latin in the result. */
export function normalizePhone(raw: string): string {
  let value = toLatinDigits(raw).replace(/[\s\-()._]/g, '');
  if (value.startsWith('+98')) value = `0${value.slice(3)}`;
  else if (value.startsWith('0098')) value = `0${value.slice(4)}`;
  else if (value.startsWith('98') && value.length === 12) value = `0${value.slice(2)}`;
  else if (value.startsWith('9') && value.length === 10) value = `0${value}`;
  return value;
}

/** True only for a canonically normalized Iranian mobile number. */
export function isValidMobile(raw: string): boolean {
  return MOBILE.test(normalizePhone(raw));
}

/**
 * Phone as shown back to the user: `0912***4567`. Never used for storage or
 * lookups — it is a display-only mask so full numbers do not appear in
 * places the owner did not intend.
 */
export function maskPhone(raw: string): string {
  const phone = normalizePhone(raw);
  if (!MOBILE.test(phone)) return '—';
  return `${phone.slice(0, 4)}***${phone.slice(7)}`;
}
