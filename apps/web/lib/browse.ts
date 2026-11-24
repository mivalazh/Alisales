import {
  CAR_BODY_GROUPS,
  PART_CATEGORY_LABELS,
  matchesBodyKeyword,
  partCategories,
  type PartCategory,
} from '@alisales/schemas';
import type { ListingCardData } from './data/listings';

/**
 * Browse-by-category (header menu) — the catalog has no body-type column, so
 * these groups are curated model keywords applied on top of the one search
 * result. Links stay `?body=…` / `?category=…` on the home page, so filters,
 * sort and search keep working inside the chosen group.
 *
 * The keyword table itself lives in `@alisales/schemas` (`CAR_BODY_GROUPS`),
 * next to the inference that fills `vehicles.body_type`: one list, one matcher,
 * so a model can never be an SUV to the database and invisible in the SUV chip.
 * Each group here is that table's `keywords` plus its `browseOnly` words, in
 * `browseOrder` — the drawer menu order, which is not the inference order.
 */
export interface CarBodyType {
  key: string;
  label: string;
  keywords: readonly string[];
}

export const CAR_BODY_TYPES: readonly CarBodyType[] = CAR_BODY_GROUPS.filter(
  (group) => group.browseOrder !== null,
)
  .slice()
  .sort((a, b) => (a.browseOrder ?? 0) - (b.browseOrder ?? 0))
  .map((group) => ({
    key: group.key,
    label: group.label,
    keywords: [...group.keywords, ...(group.browseOnly ?? [])],
  }));

export function parseBodyType(value: string | null | undefined): CarBodyType | null {
  return CAR_BODY_TYPES.find((type) => type.key === value) ?? null;
}

export function parsePartCategory(value: string | null | undefined): PartCategory | null {
  return (partCategories as readonly string[]).includes(value ?? '')
    ? (value as PartCategory)
    : null;
}

/**
 * «خودرو» group: model/trim keyword match, through the shared matcher.
 *
 * Parts never match (they have no model line worth reading), and neither do
 * motorcycles or heavy machinery: the chips are car body classes, and a
 * motorcycle called «Sportster» must not answer a `?body=coupe` link.
 */
export function matchesCarBodyKeywords(
  listing: ListingCardData,
  keywords: readonly string[],
): boolean {
  // Parts are excluded, everything else is a car unless the category says
  // motorcycle/heavy (`kind` is absent on the seeded catalogue's vehicles).
  if (listing.kind === 'part') return false;
  if ((listing.category ?? 'car') !== 'car') return false;
  return matchesBodyKeyword(`${listing.model} ${listing.trim ?? ''}`, keywords);
}

/**
 * The same predicate the SQL page applies to `p_filters->'bodyKeywords'`
 * (0023), exported so the fixture path and the parity test narrow with exactly
 * the rules the database uses.
 */
export function filterByBodyType(
  listings: readonly ListingCardData[],
  type: CarBodyType,
): ListingCardData[] {
  return listings.filter((listing) => matchesCarBodyKeywords(listing, type.keywords));
}

export function filterByPartCategory(
  listings: readonly ListingCardData[],
  category: PartCategory,
): ListingCardData[] {
  return listings.filter(
    (listing) => listing.kind === 'part' && listing.part?.category === category,
  );
}

/** Parts-only attributes that have no vehicle counterpart (origin, warranty). */
export interface PartAttributes {
  origin?: string | null;
  warrantyOnly?: boolean;
  compatibility?: string | null;
  /** Part condition: new / stock / used (three states, not the vehicle pair). */
  condition?: string | null;
}

/**
 * Narrows a parts feed by the spare-parts strip's own controls. Category is
 * handled separately (it is a first-class URL param shared with the header
 * menu), and condition rides in the shared search filters.
 */
export function filterPartsByAttributes(
  listings: readonly ListingCardData[],
  attributes: PartAttributes,
): ListingCardData[] {
  const compat = attributes.compatibility?.trim().toLowerCase() ?? '';
  return listings.filter((listing) => {
    const part = listing.part;
    if (!part) return false;
    if (attributes.origin && part.origin !== attributes.origin) return false;
    if (attributes.condition && part.condition !== attributes.condition) return false;
    if (attributes.warrantyOnly && !part.warranty?.trim()) return false;
    if (compat) {
      const haystack = `${part.compatibility ?? ''} ${part.title}`.toLowerCase();
      if (!haystack.includes(compat)) return false;
    }
    return true;
  });
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
