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

/**
 * Colour text for a stored value.
 *
 * New listings keep exactly what the seller typed («سفید صدفی»); older rows
 * still carry a `color_slug`, so known slugs are translated and anything else
 * is shown as-is.
 */
export function colorLabel(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  return COLOR_LABELS[raw as ColorSlug] ?? raw;
}

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

export const GEARBOX_LABELS: Record<Gearbox, string> = {
  manual: 'دنده دستی',
  automatic: 'دنده اتوماتیک',
  cvt: 'دنده CVT',
  dual_clutch: 'دنده دوکلاچه',
};

export const FUEL_LABELS: Record<Fuel, string> = {
  petrol: 'بنزینی',
  diesel: 'دیزلی',
  cng: 'دوگازسوز',
  hybrid: 'هیبریدی',
  electric: 'برقی',
};

export const CONDITION_LABELS: Record<Condition, string> = {
  new: 'نو',
  used: 'کارکرده',
};

export const PLATE_TYPE_LABELS: Record<PlateType, string> = {
  standard: 'پلاک ملی',
  kish: 'پلاک منطقه آزاد',
  temporary_transit: 'گذر موقت',
  unplated: 'بدون پلاک',
};

/**
 * Standard vehicle body classes (تیپ / کلاس بدنه).
 *
 * The seller picks one instead of typing a free-text trim; the value then
 * travels to the card, the filter and the «توضیحات» spec tags.
 */
export const bodyTypes = [
  'sedan',
  'suv',
  'coupe',
  'convertible',
  'hatchback',
  'crossover',
  'pickup',
  'van',
] as const;
export type BodyType = (typeof bodyTypes)[number];

export const BODY_TYPE_LABELS: Record<BodyType, string> = {
  sedan: 'سدان (سواری)',
  suv: 'شاسی‌بلند (SUV)',
  coupe: 'کوپه',
  convertible: 'کروک / کانورتیبل',
  hatchback: 'هاچ‌بک',
  crossover: 'کراس‌اوور',
  pickup: 'پیکاپ / وانت',
  van: 'ون',
};

/**
 * Paint / body condition — what the seller declares about the finish.
 * Kept separate from the new/used condition so a spotless used car can still
 * say «بی‌رنگ (فابریک)».
 */
export const paintConditions = [
  'factory',
  'minor_scratches',
  'one_spot',
  'few_spots',
  'partial_repaint',
  'full_repaint',
  'stock_replaced',
  'accident',
] as const;
export type PaintCondition = (typeof paintConditions)[number];

export const PAINT_CONDITION_LABELS: Record<PaintCondition, string> = {
  factory: 'بی‌رنگ (فابریک)',
  minor_scratches: 'خط و خش جزئی / لیسه',
  one_spot: 'یک لکه رنگ',
  few_spots: 'چند لکه رنگ',
  partial_repaint: 'دوررنگ',
  full_repaint: 'تمام رنگ',
  stock_replaced: 'تعویض استوک',
  accident: 'تصادفی / ضربه‌خورده',
};

/** Chassis declaration — front/rear/neither, sealed or repaired. */
export const chassisConditions = [
  'sealed',
  'front_damaged',
  'rear_damaged',
  'both_damaged',
] as const;
export type ChassisCondition = (typeof chassisConditions)[number];

export const CHASSIS_CONDITION_LABELS: Record<ChassisCondition, string> = {
  sealed: 'سالم و پلمپ (جلو و عقب)',
  front_damaged: 'شاسی جلو ضربه/رنگ',
  rear_damaged: 'شاسی عقب ضربه/رنگ',
  both_damaged: 'دو شاسی ضربه/رنگ',
};

/** Insurance groups the filter can ask about. */
export const insuranceKinds = ['third_party', 'body'] as const;
export type InsuranceKind = (typeof insuranceKinds)[number];

export const INSURANCE_KIND_LABELS: Record<InsuranceKind, string> = {
  third_party: 'بیمه شخص ثالث',
  body: 'بیمه بدنه',
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
