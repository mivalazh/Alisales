import type { AccountType, ProfileMode } from '@alisales/schemas';

/**
 * One rule for whether a seller has a public profile.
 *
 * The account-mode choice is authoritative. Legacy accounts without a saved
 * mode fall back to the showroom account type, then to showroom-verified
 * inventory (which also covers the fixture catalogue). Everything else is a
 * private personal seller.
 */
export type SellerVisibilityListing = {
  showroomName: string | null;
  showroomVerified: boolean;
};

export function resolveSellerProfileMode(
  customMode: ProfileMode | null | undefined,
  accountType: AccountType | null | undefined,
  listings: readonly SellerVisibilityListing[] = [],
): ProfileMode {
  if (customMode) return customMode;
  if (accountType === 'showroom') return 'business';
  if (listings.some((listing) => listing.showroomVerified || listing.showroomName)) {
    return 'business';
  }
  return 'personal';
}

export function isPublicSellerProfile(mode: ProfileMode): boolean {
  return mode === 'business';
}
