/**
 * Scroll the results grid into view after a brand/model pick.
 *
 * The filters commit to the URL and the server re-renders the grid; scrolling
 * right after the click would land on the old cards, so the call waits for the
 * next paint (and a short settle for the server response) before moving.
 * `block: 'start'` keeps the brand/model strip just out of frame when it fits.
 */
export const RESULTS_ID = 'listing-results';

export function scrollToResults(): void {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    const target = document.getElementById(RESULTS_ID);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 450);
}
