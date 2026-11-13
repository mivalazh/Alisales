import { demoListingsHidden } from '../config/mode';

/**
 * Merge seeded demo inventory with real/user-created rows.
 *
 * The launch switch (`NEXT_PUBLIC_HIDE_DEMO_LISTINGS=true`) removes only the
 * seed: every live row passed in is preserved. All catalogue, seller-profile,
 * moderation and admin reads go through this one function so no surface can
 * accidentally keep showing a sample listing.
 */
export function visibleCatalog<T>(
  seeded: readonly T[],
  live: readonly T[],
): T[] {
  return demoListingsHidden() ? [...live] : [...live, ...seeded];
}
