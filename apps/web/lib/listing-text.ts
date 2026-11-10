import {
  BRAND_LATIN,
  BIKE_TYPE_LABELS,
  GEARBOX_LABELS,
  HEAVY_TYPE_LABELS,
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
  fuel?: string;
  plateType?: string;
  category?: 'car' | 'motorcycle' | 'heavy';
  engineCc?: number | null;
  bikeType?: string | null;
  heavyType?: string | null;
  workingHours?: number | null;
  part?: { title: string } | null;
}

/**
 * Latin marque for the top line.
 *
 * Catalogue slugs resolve through `BRAND_LATIN`; a slug the catalogue does not
 * know (a custom marque stored under its own value) is still printed by
 * prettifying the slug, so a card never loses its brand line. `other` has no
 * Latin name — the model tells the story there.
 */
export function brandLatinFor(brand: string): string | null {
  if (!brand || brand === 'other') return null;
  const known = BRAND_LATIN[brand];
  if (known) return known;
  const cleaned = brand.replace(/^(bike|heavy)-/, '').replace(/[-_]+/g, ' ').trim();
  if (!cleaned) return null;
  return cleaned.replace(/\b[a-z]/g, (c) => c.toUpperCase());
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
const BIKE_TYPE_EN: Readonly<Record<string, string>> = {
  scooter: 'Scooter',
  electric: 'Electric bike',
  sport: 'Sport',
  cross: 'Cross',
  classic: 'Classic',
};

const HEAVY_TYPE_EN: Readonly<Record<string, string>> = {
  truck: 'Truck',
  tractor: 'Tractor unit',
  excavator: 'Excavator',
  loader: 'Loader',
  crane: 'Crane',
};

const GEARBOX_EN: Readonly<Record<string, string>> = {
  automatic: 'Automatic',
  manual: 'Manual',
};

export function specParts(listing: TextListing, lang: 'fa' | 'en' = 'fa'): string[] {
  if (listing.part) return [];
  const parts: string[] = [];
  const en = lang === 'en';

  if (listing.category === 'motorcycle') {
    // Electric scooters have no displacement: the drive type takes its place.
    if (listing.engineCc) parts.push(`${formatAmountLatin(listing.engineCc)} cc`);
    else if (listing.fuel === 'electric') parts.push(en ? 'Electric' : 'برقی');
    if (listing.bikeType) {
      parts.push(
        (en ? BIKE_TYPE_EN[listing.bikeType] : BIKE_TYPE_LABELS[listing.bikeType]) ??
          listing.bikeType,
      );
    }
    if (listing.mileageKm > 0) parts.push(mileageLabel(listing.mileageKm));
  } else if (listing.category === 'heavy') {
    if (listing.heavyType) {
      parts.push(
        (en ? HEAVY_TYPE_EN[listing.heavyType] : HEAVY_TYPE_LABELS[listing.heavyType]) ??
          listing.heavyType,
      );
    }
    if (listing.workingHours) {
      parts.push(`${formatAmountLatin(listing.workingHours)} ${en ? 'h' : 'ساعت'}`);
    }
    if (listing.mileageKm > 0) parts.push(mileageLabel(listing.mileageKm));
  } else {
    if (listing.mileageKm > 0) parts.push(mileageLabel(listing.mileageKm));
    if (listing.gearbox && GEARBOX_LABELS[listing.gearbox as keyof typeof GEARBOX_LABELS]) {
      const gearbox = listing.gearbox as keyof typeof GEARBOX_LABELS;
      parts.push((en ? GEARBOX_EN[gearbox] : GEARBOX_LABELS[gearbox]) ?? gearbox);
    }
  }

  // The plate status already rides as a badge above the title on cards and
  // rows, so the spec line keeps only the facts that are not repeated above:
  // mileage, gearbox, displacement, machine type and working hours.
  return parts;
}
