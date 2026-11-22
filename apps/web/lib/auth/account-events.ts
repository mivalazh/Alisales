/**
 * Client-side signal that the signed-in account changed.
 *
 * The site shell is static, so the header learns the account from
 * `/api/auth/me` after hydration instead of from a server render. That leaves
 * one gap: after signing in, signing out or saving a profile, nothing tells the
 * header to ask again. Components that change the account call
 * `notifyAccountChanged()` once the server has accepted the change; the header
 * listens and refetches. The session itself still never enters the static
 * render — only this event crosses the boundary.
 */
export const ACCOUNT_CHANGED_EVENT = 'alisales:account-changed';

export function notifyAccountChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ACCOUNT_CHANGED_EVENT));
}
