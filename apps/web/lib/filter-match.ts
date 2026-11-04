import type { SearchFilters } from '@alisales/schemas';

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
  hasReport: boolean;
  /** Category-specific specs — absent on cars and parts. */
  category?: 'car' | 'motorcycle' | 'heavy';
  engineCc?: number | null;
  bikeType?: string | null;
  heavyType?: string | null;
  workingHours?: number | null;
}

export function matchesFilters(listing: FilterableListing, f: SearchFilters): boolean {
  if (f.city.length && !f.city.includes(listing.city)) return false;
  if (f.kishOnly && listing.city !== 'kish') return false;
  if (f.brand.length && !f.brand.some((b) => b === listing.brand)) return false;
  if (f.model && !listing.model.toLowerCase().includes(f.model.toLowerCase())) return false;
  if (f.trim && !(listing.trim ?? '').toLowerCase().includes(f.trim.toLowerCase())) return false;
  if (f.yearFrom !== undefined && listing.year < f.yearFrom) return false;
  if (f.yearTo !== undefined && listing.year > f.yearTo) return false;
  if (f.priceFrom !== undefined && listing.priceIRR < f.priceFrom) return false;
  if (f.priceTo !== undefined && listing.priceIRR > f.priceTo) return false;
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
  if (f.q && !`${listing.model} ${listing.trim ?? ''} ${listing.brand}`.includes(f.q)) {
    return false;
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
