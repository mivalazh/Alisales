/**
 * Canonical public URLs. `NEXT_PUBLIC_SITE_URL` wins in hosted deployments;
 * the production domain is the fallback so sitemap and JSON-LD never emit a
 * relative identifier Google cannot reconcile.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://alisales.ir'
).replace(/\/$/, '');

export const RENTAL_URL = 'https://rent.alisales.ir';

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
