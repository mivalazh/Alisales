// Enums
// Importing the schemas package installs the platform-wide Persian error map
// (see ./errors) — the entire UI is Persian-only.
export { installPersianErrors, issueToPersian } from './errors';
export {
  listingStates,
  plateTypes,
  conditions,
  gearboxTypes,
  fuelTypes,
  colorSlugs,
  COLOR_LABELS,
  GEARBOX_LABELS,
  FUEL_LABELS,
  CONDITION_LABELS,
  PLATE_TYPE_LABELS,
  userRoles,
  showroomStaffRoles,
  subscriptionStatuses,
  reportStatuses,
  panelConditions,
  abuseReasons,
  abuseStatuses,
} from './enums';
export type {
  ListingState,
  PlateType,
  Condition,
  Gearbox,
  Fuel,
  ColorSlug,
  UserRole,
  ShowroomStaffRole,
  SubscriptionStatus,
  ReportStatus,
  PanelCondition,
  AbuseReason,
  AbuseStatus,
} from './enums';

// Vehicle
export {
  BRANDS,
  brandSlugs,
  CITIES,
  citySlugs,
  MIN_VEHICLE_YEAR,
  MAX_VEHICLE_YEAR,
  vehicleSchema,
} from './vehicle';
export type { BrandSlug, VehicleInput } from './vehicle';

// Feature flags (one source for web + mobile)
export { featureFlags, DEFAULT_CITY, selectableCities } from './features';
export type { FeatureFlag } from './features';

// Listing
export {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  ALLOWED_PHOTO_MIME,
  listingPhotoSchema,
  LISTING_FIELD_LABELS,
  listingDraftSchema,
  listingPublishSchema,
  listingTransitions,
  canTransition,
  isSlotState,
} from './listing';
export type { ListingPhoto, ListingDraft, ListingPublish, TransitionActor } from './listing';

// Subscriptions
export {
  FREE_LISTING_LIMIT,
  PLAN_CODES,
  planSchema,
  DEFAULT_PLANS,
  planFor,
  remainingSlots,
  canCreateListing,
} from './subscription';
export type { PlanCode, Plan } from './subscription';

// Persian locale (digits, IRR amounts, Jalali dates) — shared by web, mobile, edge
export {
  toPersianDigits,
  groupDigits,
  formatIRR,
  toJalali,
  jalaliOf,
  formatJalali,
  formatJalaliDate,
} from './locale';
export type { JalaliDate } from './locale';

// Posting age (relative text; Jalali day boundaries in Asia/Tehran)
export {
  TEHRAN_OFFSET_MS,
  tehranDayIndex,
  postingAgeDays,
  postingAgeLabel,
} from './posting-age';

// Search filters + URL codec
export {
  searchFiltersSchema,
  DEFAULT_FILTERS,
  parseFiltersFromSearchParams,
  filtersToSearchParams,
  serializeFilters,
  parseFilterQueryString,
  filtersToRpcPayload,
  activeFilterCount,
  toAsciiDigits,
  BRAND_LABELS,
  CITY_LABELS,
} from './filters';
export type { SearchFilters } from './filters';

// Legal gate — plate sections (seller-declared status)
export {
  PLATE_SECTIONS,
  PLATE_DECLARATION_FOOTER,
  plateSectionKey,
  plateStatement,
} from './legal';
export type { PlateSectionKey } from './legal';

// Digits (S2): visible numbers always render with Latin digits
export {
  toLatinDigits,
  groupLatinDigits,
  formatAmountLatin,
  formatPriceLatin,
} from './digits';

// Phone (S2 login)
export { normalizePhone, isValidMobile, maskPhone } from './phone';

// OTP policy (S2 login)
export {
  OTP_LENGTH,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  isOtpCode,
  otpStatus,
  otpEquals,
  otpStatusMessage,
  otpResendWaitSeconds,
} from './otp';
export type { OtpStatus } from './otp';

// Account profile (S2 first login)
export {
  accountTypes,
  ACCOUNT_TYPE_LABELS,
  displayNameSchema,
  profileSchema,
  accountTypeLabel,
} from './profile';
export type { AccountType, ProfileInput } from './profile';

// Open-redirect guard for ?next= (S2 security rule)
export { DEFAULT_NEXT_PATH, safeNextPath, loginHref } from './safe-next';

// Structured visit requests in chat (visit_request_chat)
export {
  VISIT_REQUEST_DEFAULT_MESSAGE,
  visitSlotSchema,
  isValidVisitDate,
  messageKinds,
  MESSAGE_KIND_LABELS,
  isVisitKind,
  visitSlotLabel,
  visitMessageBody,
} from './visit';
export type { VisitSlot, MessageKind } from './visit';

// Parts & accessories listings (parts_listings)
export {
  partCategories,
  partOrigins,
  partConditions,
  PART_CATEGORY_LABELS,
  PART_ORIGIN_LABELS,
  PART_CONDITION_LABELS,
  PART_COMPATIBILITY_GENERAL,
  PART_FIELD_LABELS,
  compatibilityLabel,
  partListingPublishSchema,
} from './parts';
export type {
  PartCategory,
  PartOrigin,
  PartCondition,
  PartListingPublish,
} from './parts';

// Owner statistics (S2 / C2)
export { summarizeOwnerStats, totalOwnerStats } from './stats';
export type { ListingOwnerStats, OwnerStatsInput } from './stats';

// Owner statistics ordering (per-listing rows)
export {
  OWNER_STATS_SORTS,
  OWNER_STATS_SORT_LABELS,
  parseOwnerStatsSort,
  sortOwnerStats,
} from './owner-stats-sort';
export type { OwnerStatsSort } from './owner-stats-sort';

// Listing edit (owner PATCH) + AED/Toman entry helpers
export {
  LISTING_EDIT_LOCKED_FIELDS,
  listingEditSchema,
  ownerStateTargets,
  listingStateChangeSchema,
  AED_TO_IRR,
  IRR_PER_TOMAN,
  aedToIRR,
  irrToAED,
  tomanToIRR,
  irrToToman,
} from './listing-edit';
export type { ListingEdit, OwnerStateTarget } from './listing-edit';

// Read-only plan preview («بزودی») behind the third-listing gate
export { PLAN_PREVIEW_SOON, PLAN_PREVIEWS } from './plan-preview';
export type { PlanPreviewCard } from './plan-preview';

// «گزارش آگهی» (abuse reports)
export { ABUSE_REASON_LABELS, ABUSE_HIDE_THRESHOLD, abuseReportSchema } from './abuse';
export type { AbuseReportInput } from './abuse';

// Free-tier publish limit (S2 / C6)
export {
  FREE_THIRD_LISTING_MESSAGE,
  countsTowardFreeLimit,
  activeListingCount,
  freeLimitDecision,
} from './listing-limit';
export type { FreeLimitDecision } from './listing-limit';
