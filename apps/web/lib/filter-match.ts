import {
  BIKE_TYPE_LABELS,
  CHASSIS_CONDITION_LABELS,
  HEAVY_TYPE_LABELS,
  PAINT_CONDITION_LABELS,
  BODY_TYPE_LABELS,
  fuzzySearchMatch,
  inferBodyType,
  type BodyType,
  type SearchFilters,
} from '@alisales/schemas';

/**
 * Pure filter predicate shared by the server search and the client filter
 * strip.
 *
 * The URL stays the source of truth — the strip commits to it and the server
 * re-runs the one search — but the strip also needs to preview how many cards a
 * pending filter set would show («نمایش N آگهی») before navigating. Keeping one
 * predicate here means the preview can never disagree with the result.
 *
 * Structural on purpose: importing the listing type would drag server data
 * modules into the browser bundle.
 */
export interface FilterableListing {
  city: string;
  brand: string;
  model: string;
  trim?: string | null;
  year: number;
  priceIRR: number;
  mileageKm: number;
  gearbox: string;
  fuel?: string;
  plateType: string;
  condition: string;
  bodyType?: BodyType | null;
  hasReport: boolean;
  /** Category-specific specs — absent on cars and parts. */
  category?: 'car' | 'motorcycle' | 'heavy';
  engineCc?: number | null;
  bikeType?: string | null;
  heavyType?: string | null;
  workingHours?: number | null;
  /** Seller-declared condition columns (vehicles only). */
  thirdPartyInsurance?: boolean | null;
  bodyInsurance?: boolean | null;
  paintCondition?: string | null;
  chassisCondition?: string | null;
  technicalInspection?: boolean | null;
  color?: string | null;
}

export function matchesFilters(listing: FilterableListing, f: SearchFilters): boolean {
  if (f.city.length && !f.city.includes(listing.city)) return false;
  if (f.kishOnly && listing.city !== 'kish') return false;
  if (f.brand.length && !f.brand.some((b) => b === listing.brand)) return false;
  if (f.bodyType.length) {
    // Legacy rows have no stored class; infer it from the model so the
    // drawer's body shortcuts still find real inventory.
    const body = listing.bodyType ?? inferBodyType(listing.model);
    if (!(f.bodyType as readonly string[]).includes(body ?? '')) return false;
  }
  if (f.model && !listing.model.toLowerCase().includes(f.model.toLowerCase())) return false;
  if (f.trim && !(listing.trim ?? '').toLowerCase().includes(f.trim.toLowerCase())) return false;
  if (f.yearFrom !== undefined && listing.year < f.yearFrom) return false;
  if (f.yearTo !== undefined && listing.year > f.yearTo) return false;
  if (f.priceFrom !== undefined && listing.priceIRR < f.priceFrom) return false;
  if (f.priceTo !== undefined && listing.priceIRR > f.priceTo) return false;
  if (f.mileageMin !== undefined && listing.mileageKm < f.mileageMin) return false;
  if (f.mileageMax !== undefined && listing.mileageKm > f.mileageMax) return false;
  if (f.gearbox.length && !(f.gearbox as readonly string[]).includes(listing.gearbox)) return false;
  if (f.fuel.length && !(f.fuel as readonly string[]).includes(listing.fuel ?? '')) return false;
  if (f.plateType.length && !(f.plateType as readonly string[]).includes(listing.plateType)) {
    return false;
  }
  if (f.condition.length && !(f.condition as readonly string[]).includes(listing.condition)) {
    return false;
  }
  // Category-specific groups: only constrain rows of that category, so a car
  // search is never emptied by a bike filter left over in the URL.
  if (f.bikeType.length && listing.category === 'motorcycle') {
    if (!(f.bikeType as readonly string[]).includes(listing.bikeType ?? '')) return false;
  }
  if (f.heavyType.length && listing.category === 'heavy') {
    if (!(f.heavyType as readonly string[]).includes(listing.heavyType ?? '')) return false;
  }
  if (f.engineCcMin !== undefined || f.engineCcMax !== undefined) {
    if (listing.category === 'motorcycle') {
      const cc = listing.engineCc ?? 0;
      if (f.engineCcMin !== undefined && cc < f.engineCcMin) return false;
      if (f.engineCcMax !== undefined && cc > f.engineCcMax) return false;
    }
  }
  if (f.workingHoursMax !== undefined && listing.category === 'heavy') {
    if ((listing.workingHours ?? 0) > f.workingHoursMax) return false;
  }
  if (f.hasReport && !listing.hasReport) return false;

  // Insurance + inspection declarations. Rows that never asked the question
  // (null) are excluded when the buyer explicitly filters for an answer.
  if (f.insurance.includes('third_party') && listing.thirdPartyInsurance !== true) return false;
  if (f.insurance.includes('body') && listing.bodyInsurance !== true) return false;
  if (
    f.paintCondition.length &&
    !(f.paintCondition as readonly string[]).includes(listing.paintCondition ?? '')
  ) {
    return false;
  }
  if (
    f.chassisCondition.length &&
    !(f.chassisCondition as readonly string[]).includes(listing.chassisCondition ?? '')
  ) {
    return false;
  }
  if (f.technicalInspection === 'yes' && listing.technicalInspection !== true) return false;
  if (f.technicalInspection === 'no' && listing.technicalInspection !== false) return false;

  // Free-text query is fuzzy and bilingual: «لندکروز» / «landcruiser» with a
  // typo both hit a «Land Cruiser VXR» row (see @alisales/schemas/search).
  if (f.q) {
    const haystack = [
      listing.brand,
      listing.model,
      listing.trim ?? '',
      listing.color ?? '',
      listing.bodyType ? BODY_TYPE_LABELS[listing.bodyType] : '',
      listing.paintCondition ? PAINT_CONDITION_LABELS[listing.paintCondition as keyof typeof PAINT_CONDITION_LABELS] : '',
      listing.chassisCondition
        ? `شاسی ${CHASSIS_CONDITION_LABELS[listing.chassisCondition as keyof typeof CHASSIS_CONDITION_LABELS]}`
        : '',
      listing.thirdPartyInsurance ? 'بیمه شخص ثالث دارد' : '',
      listing.technicalInspection ? 'معاینه فنی دارد' : '',
      // Category words, so «اسکوتر» / «موتور برقی» / «ماشین سنگین» find the
      // fleet even when the seller only wrote the model name.
      listing.category === 'motorcycle'
        ? `موتور سیکلت اسکوتر برقی electric motorcycle scooter ${listing.bikeType ? (BIKE_TYPE_LABELS[listing.bikeType] ?? '') : ''}`
        : '',
      listing.category === 'heavy'
        ? `ماشین آلات سنگین راهسازی کامیون heavy machinery ${listing.heavyType ? (HEAVY_TYPE_LABELS[listing.heavyType] ?? '') : ''}`
        : '',
      listing.category === 'car' ? 'خودرو ماشین car vehicle' : '',
    ].join(' ');
    if (!fuzzySearchMatch(haystack, f.q)) return false;
  }
  return true;
}

/** Count of listings a (pending) filter set would show. */
export function countMatches(
  listings: readonly FilterableListing[],
  filters: SearchFilters,
): number {
  return listings.filter((listing) => matchesFilters(listing, filters)).length;
}
