/** Shared enums — mirrored by Postgres enum types in supabase/migrations. */

export const listingStates = [
  'draft',
  'pending_review',
  'active',
  'paused',
  'sold',
  'expired',
  'rejected',
] as const;
export type ListingState = (typeof listingStates)[number];

/** Plate types. Kish / temporary transit / unplated get distinct UI sections. */
export const plateTypes = ['standard', 'kish', 'temporary_transit', 'unplated'] as const;
export type PlateType = (typeof plateTypes)[number];

export const conditions = ['new', 'used'] as const;
export type Condition = (typeof conditions)[number];

export const gearboxTypes = ['manual', 'automatic', 'cvt', 'dual_clutch'] as const;
export type Gearbox = (typeof gearboxTypes)[number];

export const fuelTypes = ['petrol', 'diesel', 'cng', 'hybrid', 'electric'] as const;
export type Fuel = (typeof fuelTypes)[number];

export const colorSlugs = [
  'white',
  'black',
  'silver',
  'gray',
  'red',
  'blue',
  'green',
  'beige',
  'brown',
  'gold',
  'orange',
  'other',
] as const;
export type ColorSlug = (typeof colorSlugs)[number];

export const COLOR_LABELS: Record<ColorSlug, string> = {
  white: 'سفید',
  black: 'مشکی',
  silver: 'نقره‌ای',
  gray: 'خاکستری',
  red: 'قرمز',
  blue: 'آبی',
  green: 'سبز',
  beige: 'بژ',
  brown: 'قهوه‌ای',
  gold: 'طلایی',
  orange: 'نارنجی',
  other: 'سایر',
};

/** account-level roles (showroom membership lives in showroom_staff) */
export const userRoles = ['individual', 'inspector', 'admin'] as const;
export type UserRole = (typeof userRoles)[number];

export const showroomStaffRoles = ['owner', 'editor'] as const;
export type ShowroomStaffRole = (typeof showroomStaffRoles)[number];

export const subscriptionStatuses = [
  'pending',
  'active',
  'past_due',
  'cancelled',
  'expired',
] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export const reportStatuses = ['draft', 'finalized'] as const;
export type ReportStatus = (typeof reportStatuses)[number];

export const panelConditions = ['original', 'repainted', 'replaced', 'damaged'] as const;
export type PanelCondition = (typeof panelConditions)[number];

export const abuseReasons = [
  'fraud',
  'wrong_info',
  'inappropriate',
  'copyright',
  'spam',
  'other',
] as const;
export type AbuseReason = (typeof abuseReasons)[number];

export const abuseStatuses = ['open', 'reviewing', 'dismissed', 'actioned'] as const;
export type AbuseStatus = (typeof abuseStatuses)[number];
