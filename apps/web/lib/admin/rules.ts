/**
 * Owner/admin access rules (`/admin` and `/api/admin`).
 *
 * The allow-list is an environment variable rather than a database column:
 *  - `ADMIN_PHONES` — comma/space separated mobile numbers, e.g.
 *    `09123456789,09351234567`. Digits, `+98` and `0098` prefixes all work.
 *
 * Why phones: every account is phone-verified at sign-up, so the number is the
 * strongest stable identity the platform has, and the list can be rotated by
 * editing one environment variable (no migration, no SQL).
 *
 * Demo rule: a fixture/demo deployment (no Supabase credentials) with an empty
 * `ADMIN_PHONES` lets any signed-in account in, so the owner can review the
 * moderation hub on the preview link. A hosted deployment (Supabase configured,
 * or `REQUIRE_HOSTED_SERVICES=true`) never falls back — without `ADMIN_PHONES`
 * the hub answers "not found" for everybody.
 */

import { toAsciiDigits } from '@alisales/schemas';

export const ADMIN_PHONES_ENV = 'ADMIN_PHONES';

/**
 * Canonical 11-digit Iranian mobile (`09xxxxxxxxx`), or an empty string when
 * the input cannot be a mobile number.
 */
export function normalizeAdminPhone(raw: string): string {
  let value = toAsciiDigits(String(raw ?? '')).replace(/[\s()-]/g, '');
  if (value.startsWith('+98')) value = `0${value.slice(3)}`;
  else if (value.startsWith('0098')) value = `0${value.slice(4)}`;
  else if (value.startsWith('98') && value.length === 12) value = `0${value.slice(2)}`;
  else if (value.length === 10 && value.startsWith('9')) value = `0${value}`;
  return /^09\d{9}$/.test(value) ? value : '';
}

/** Parses `ADMIN_PHONES` into a de-duplicated canonical list. */
export function parseAdminPhones(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of String(raw).split(/[,\s]+/)) {
    const phone = normalizeAdminPhone(part);
    if (phone) seen.add(phone);
  }
  return [...seen];
}

export type AdminAccess = 'admin' | 'forbidden' | 'guest';

/**
 * Decides what a request may do.
 *
 * @param phone     session phone, or null for a guest
 * @param adminPhones parsed `ADMIN_PHONES`
 * @param fixture   fixture/demo deployment (no hosted data credentials)
 */
export function adminAccess(
  phone: string | null | undefined,
  adminPhones: readonly string[],
  fixture: boolean,
): AdminAccess {
  if (!phone) return 'guest';
  const canonical = normalizeAdminPhone(phone);
  if (canonical && adminPhones.includes(canonical)) return 'admin';
  if (fixture) return 'admin';
  return 'forbidden';
}

/** True when the hub should be linked in the header for this visitor. */
export function canSeeAdminLink(access: AdminAccess): boolean {
  return access === 'admin';
}
