import { PART_CATEGORY_LABELS, partCategories, type PartCategory } from '@alisales/schemas';
import type { ListingCardData } from './data/listings';

/**
 * Browse-by-category (header menu) — the catalog has no body-type column, so
 * these groups are curated model keywords applied on top of the one search
 * result. Links stay `?body=…` / `?category=…` on the home page, so filters,
 * sort and search keep working inside the chosen group.
 */
export interface CarBodyType {
  key: string;
  label: string;
  keywords: readonly string[];
}

export const CAR_BODY_TYPES: readonly CarBodyType[] = [
  {
    key: 'suv',
    label: 'SUV',
    keywords: [
      'suv',
      'land cruiser',
      'prado',
      'patrol',
      'x5',
      'x6',
      'x-trail',
      'tucson',
      'sportage',
      'santa fe',
      'palisade',
      'range rover',
      'cayenne',
      'gle',
      'g-class',
      'lx',
      'fortuner',
    ],
  },
  {
    key: 'sedan',
    label: 'سدان',
    keywords: [
      'sedan',
      'camry',
      'sonata',
      'elantra',
      'optima',
      'e-class',
      's-class',
      '5 series',
      '7 series',
      '3 series',
      'accord',
      'teana',
      'cerato',
      'پژو پارس',
      'سمند',
    ],
  },
  {
    key: 'hatchback',
    label: 'هاچ‌بک',
    keywords: ['hatchback', 'هاچبک', 'کوییک', 'تیبا', 'ساینا', '۲۰۶', '206', 'i20', 'picanto'],
  },
  {
    key: 'coupe',
    label: 'کوپه و اسپورت',
    keywords: ['coupe', 'کوپه', 'sport', 'اسپرت', 'mustang', 'camaro', '911', 'm4', 'c63'],
  },
  {
    key: 'crossover',
    label: 'کراس‌اوور',
    keywords: ['crossover', 'کراساوور', 'hr-v', 'cx-5', 'qashqai', 'creta', 'seltos', 'juke'],
  },
  {
    key: 'luxury',
    label: 'لوکس و لیموزین',
    keywords: [
      'luxury',
      'limousine',
      'لیموزین',
      's-class',
      '7 series',
      'a8',
      'range rover',
      'bentley',
      'rolls',
      'porsche',
      'panamera',
      'lexus',
    ],
  },
  {
    key: 'hybrid',
    label: 'خودروی برقی و هیبرید',
    keywords: ['hybrid', 'هیبرید', 'electric', 'برقی', 'ev', 'tesla', 'priya', 'prius', 'byd'],
  },
] as const;

export function parseBodyType(value: string | null | undefined): CarBodyType | null {
  return CAR_BODY_TYPES.find((type) => type.key === value) ?? null;
}

export function parsePartCategory(value: string | null | undefined): PartCategory | null {
  return (partCategories as readonly string[]).includes(value ?? '')
    ? (value as PartCategory)
    : null;
}

/** «خودرو» group: model/trim keyword match; parts never match a body type. */
export function filterByBodyType(
  listings: readonly ListingCardData[],
  type: CarBodyType,
): ListingCardData[] {
  return listings.filter((listing) => {
    if (listing.kind === 'part') return false;
    const haystack = `${listing.model} ${listing.trim ?? ''}`.toLowerCase();
    return type.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  });
}

export function filterByPartCategory(
  listings: readonly ListingCardData[],
  category: PartCategory,
): ListingCardData[] {
  return listings.filter(
    (listing) => listing.kind === 'part' && listing.part?.category === category,
  );
}

/** «قطعات و لوازم» menu links — derived, so the eight categories never drift. */
export const PART_CATEGORY_LINKS: ReadonlyArray<{
  key: PartCategory;
  label: string;
  href: string;
}> = partCategories.map((category) => ({
  key: category,
  label: PART_CATEGORY_LABELS[category],
  href: `/?category=${category}`,
}));
