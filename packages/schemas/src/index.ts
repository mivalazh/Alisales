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

// Listing
export {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  ALLOWED_PHOTO_MIME,
  listingPhotoSchema,
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
