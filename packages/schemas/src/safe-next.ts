/**
 * Open-redirect guard for `?next=` (S2 security rule).
 *
 * Only same-site absolute paths are allowed: the value must start with exactly
 * one `/`, must not be protocol-relative (`//host`), must not contain a
 * backslash (browsers treat `/\host` as `//host`), a scheme (`https:`,
 * `javascript:`), control characters or whitespace. Anything else falls back
 * to the caller's fallback (`/` by default) instead of being followed.
 */

export const DEFAULT_NEXT_PATH = '/';
const MAX_LENGTH = 512;
const CONTROL_OR_SPACE = /[\u0000-\u0020\u007f]/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const ENCODED_TRAPS = ['%5c', '%2f%2f', '%00'];

export function safeNextPath(
  raw: string | null | undefined,
  fallback: string = DEFAULT_NEXT_PATH,
): string {
  if (typeof raw !== 'string') return fallback;
  const value = raw.trim();

  if (value.length === 0 || value.length > MAX_LENGTH) return fallback;
  if (!value.startsWith('/')) return fallback; // rejects https://, javascript:, relative
  if (value.startsWith('//')) return fallback; // protocol-relative
  if (value.includes('\\')) return fallback; // /\evil.com
  if (CONTROL_OR_SPACE.test(value)) return fallback;
  if (SCHEME.test(value)) return fallback;

  const lowered = value.toLowerCase();
  if (ENCODED_TRAPS.some((trap) => lowered.includes(trap))) return fallback;

  try {
    const origin = 'http://alisales.local';
    const resolved = new URL(value, origin);
    if (resolved.origin !== origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}

/** `/login?next=…` with a sanitized, encoded return path. */
export function loginHref(next: string | null | undefined): string {
  return `/login?next=${encodeURIComponent(safeNextPath(next))}`;
}
