import {
  BRAND_LATIN,
  BIKE_TYPE_LABELS,
  GEARBOX_LABELS,
  HEAVY_TYPE_LABELS,
  PLATE_TYPE_LABELS,
  formatAmountLatin,
} from '@alisales/schemas';

/**
 * How a listing's brand, title and spec line read.
 *
 * Card, row and detail header share these helpers so the same listing never
 * describes itself two different ways:
 *  - the Latin marque sits above the model (`dir="ltr"`, never reordered),
 *  - the model line is a single `<bdi>` so «Land Cruiser VXR 1444» keeps its
 *    order next to Persian text,
 *  - the spec line is a list of separate facts with Latin digits and thousand
 *    separators, never one run of mixed text that collides with the price.
 */
export interface TextListing {
  brand: string;
  model: string;
  trim?: string | null;
  year: number;
  mileageKm: number;
  gearbox?: string;
  plateType?: string;
  category?: 'car' | 'motorcycle' | 'heavy';
  engineCc?: number | null;
  bikeType?: string | null;
  heavyType?: string | null;
  workingHours?: number | null;
  part?: { title: string } | null;
}

/** Latin marque for the top line; `other` has none (the model tells the story). */
export function brandLatinFor(brand: string): string | null {
  if (!brand || brand === 'other') return null;
  return BRAND_LATIN[brand] ?? null;
}

/** «Land Cruiser VXR» — model plus trim, without the year. */
export function vehicleTitle(listing: TextListing): string {
  return `${listing.model}${listing.trim ? ` ${listing.trim}` : ''}`;
}

/** Human mileage with Latin digits and separators: `96,000 km`. */
export function mileageLabel(km: number): string {
  return `${formatAmountLatin(km)} km`;
}

/**
 * The spec line facts, already Persian/Latin-mixed but each one its own item.
 * Empty values are dropped, so a bike without a plate shows «890 cc · اسپرت».
 */
export function specParts(listing: TextListing): string[] {
  if (listing.part) return [];
  const parts: string[] = [];

  if (listing.category === 'motorcycle') {
    if (listing.engineCc) parts.push(`${formatAmountLatin(listing.engineCc)} cc`);
    if (listing.bikeType) parts.push(BIKE_TYPE_LABELS[listing.bikeType] ?? listing.bikeType);
    if (listing.mileageKm > 0) parts.push(mileageLabel(listing.mileageKm));
  } else if (listing.category === 'heavy') {
    if (listing.heavyType) parts.push(HEAVY_TYPE_LABELS[listing.heavyType] ?? listing.heavyType);
    if (listing.workingHours) {
      parts.push(`${formatAmountLatin(listing.workingHours)} hours`);
    }
    if (listing.mileageKm > 0) parts.push(mileageLabel(listing.mileageKm));
  } else {
    if (listing.mileageKm > 0) parts.push(mileageLabel(listing.mileageKm));
    if (listing.gearbox && GEARBOX_LABELS[listing.gearbox as keyof typeof GEARBOX_LABELS]) {
      parts.push(GEARBOX_LABELS[listing.gearbox as keyof typeof GEARBOX_LABELS]);
    }
  }

  if (listing.plateType && PLATE_TYPE_LABELS[listing.plateType as keyof typeof PLATE_TYPE_LABELS]) {
    parts.push(PLATE_TYPE_LABELS[listing.plateType as keyof typeof PLATE_TYPE_LABELS]);
  }
  return parts;
}
