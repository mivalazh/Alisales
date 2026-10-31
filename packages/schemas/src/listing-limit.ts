import type { ListingState } from './enums';
import { FREE_LISTING_LIMIT } from './subscription';

/**
 * Free-tier publish limit (S2 / C6).
 *
 * Only `active` listings consume the two free slots: a listing that is sold,
 * paused (the «بایگانی‌شده» tab) or expired never blocks a new one. Anything
 * that is already public counts, so the check is done on the live state.
 */
export const FREE_THIRD_LISTING_MESSAGE = 'برای آگهی سوم، پلن انتخاب کن.';

/** True when the state occupies one of the two free slots. */
export function countsTowardFreeLimit(state: ListingState): boolean {
  return state === 'active';
}

export function activeListingCount(states: readonly ListingState[]): number {
  return states.filter(countsTowardFreeLimit).length;
}

export interface FreeLimitDecision {
  allowed: boolean;
  /** Persian message to show when the third active listing is attempted. */
  message: string | null;
  remaining: number;
}

export function freeLimitDecision(
  activeCount: number,
  limit: number = FREE_LISTING_LIMIT,
): FreeLimitDecision {
  const remaining = Math.max(0, limit - activeCount);
  if (activeCount >= limit) {
    return { allowed: false, message: FREE_THIRD_LISTING_MESSAGE, remaining: 0 };
  }
  return { allowed: true, message: null, remaining };
}
