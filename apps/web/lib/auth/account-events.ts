/**
 * Client-side signal that the signed-in account changed.
 *
 * The site shell is static, so the header learns the account from
 * `/api/auth/me` after hydration instead of from a server render. That leaves
 * one gap: after signing in, signing out or saving a profile, nothing tells the
 * header to ask again. Components that change the account call
 * `notifyAccountChanged()` once the server has accepted the change; the header
 * listens and refetches. The session itself still never enters the static
 * render — only this signal crosses the boundary.
 *
 * The session cookie is shared by every tab, so a change made in one tab leaves
 * the others stale. The same call therefore writes a nonce to `localStorage`:
 * a `storage` event reaches every *other* tab of the origin (the writing tab is
 * covered by the event above), and those headers refetch too.
 */
export const ACCOUNT_CHANGED_EVENT = 'alisales:account-changed';

/** Written only to raise a `storage` event; the value is a throwaway nonce. */
const ACCOUNT_CHANGED_KEY = 'alisales:account-changed-at';

export function notifyAccountChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ACCOUNT_CHANGED_EVENT));
  try {
    // A new value every time: writing the same one would not notify anyone.
    window.localStorage.setItem(ACCOUNT_CHANGED_KEY, `${Date.now()}:${Math.random()}`);
  } catch {
    // Storage can be unavailable (private mode, blocked site data): this tab
    // still updates, the others wait for their next read.
  }
}

/**
 * Runs `listener` when the account changes in this tab or in another one.
 * Returns the unsubscribe function.
 */
export function onAccountChanged(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent): void => {
    if (event.key === ACCOUNT_CHANGED_KEY) listener();
  };
  window.addEventListener(ACCOUNT_CHANGED_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(ACCOUNT_CHANGED_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}
