import { z } from 'zod';
import {
  bodyTypes,
  chassisConditions,
  conditions,
  fuelTypes,
  gearboxTypes,
  insuranceKinds,
  paintConditions,
  plateTypes,
} from './enums';
import { BRAND_NAME, CITIES, MAX_VEHICLE_YEAR, MIN_VEHICLE_YEAR, brandSlugs } from './vehicle';
import { bikeTypeKeys, heavyTypeKeys } from './categories';

/**
 * Search filters — the URL is the source of truth on web, and the same shape
 * is passed to the `search_listings` RPC (single filter implementation in DB).
 *
 * The category-specific blocks (bike type / heavy type / engine cc / working
 * hours) only ever apply to listings of that category, so a car search is
 * unaffected by them and vice versa.
 */
const citySlugsTuple = CITIES.map((c) => c.slug) as [string, ...string[]];

export const searchFiltersSchema = z.object({
  brand: z.array(z.enum(brandSlugs)).default([]),
  model: z.string().trim().min(1).max(60).optional(),
  /** Body class (سدان / شاسی‌بلند / کوپه …) — used by the drawer shortcuts. */
  bodyType: z.array(z.enum(bodyTypes)).default([]),
  /** Trim/تیپ free-text — «VXR», «S 500», «Platinum». */
  trim: z.string().trim().min(1).max(60).optional(),
  yearFrom: z.number().int().min(MIN_VEHICLE_YEAR).max(MAX_VEHICLE_YEAR).optional(),
  yearTo: z.number().int().min(MIN_VEHICLE_YEAR).max(MAX_VEHICLE_YEAR).optional(),
  priceFrom: z.number().int().min(0).max(10 ** 15).optional(),
  priceTo: z.number().int().min(0).max(10 ** 15).optional(),
  mileageMin: z.number().int().min(0).max(2_000_000).optional(),
  mileageMax: z.number().int().min(0).max(2_000_000).optional(),
  /** Which insurance policies the car must have («دارد»). */
  insurance: z.array(z.enum(insuranceKinds)).default([]),
  /** Declared paint/body condition. */
  paintCondition: z.array(z.enum(paintConditions)).default([]),
  /** Declared chassis condition («شاسی پلمپ» / ضربه‌خورده). */
  chassisCondition: z.array(z.enum(chassisConditions)).default([]),
  /** Technical inspection ticket: yes / no / any. */
  technicalInspection: z.enum(['yes', 'no']).optional(),
  gearbox: z.array(z.enum(gearboxTypes)).default([]),
  fuel: z.array(z.enum(fuelTypes)).default([]),
  plateType: z.array(z.enum(plateTypes)).default([]),
  condition: z.array(z.enum(conditions)).default([]),
  city: z.array(z.enum(citySlugsTuple)).default([]),
  /** Motorcycles: displacement window in cc. */
  engineCcMin: z.number().int().min(0).max(3000).optional(),
  engineCcMax: z.number().int().min(0).max(3000).optional(),
  bikeType: z.array(z.enum(bikeTypeKeys)).default([]),
  /** Heavy machinery: class and a working-hours ceiling. */
  heavyType: z.array(z.enum(heavyTypeKeys)).default([]),
  workingHoursMax: z.number().int().min(0).max(500_000).optional(),
  hasReport: z.boolean().default(false),
  kishOnly: z.boolean().default(false),
  q: z.string().trim().min(1).max(80).optional(),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export const DEFAULT_FILTERS: SearchFilters = searchFiltersSchema.parse({});

/** ۰۱۲۳۴۵۶۷۸۹ → 0123456789 (Persian digits accepted in every numeric field). */
export function toAsciiDigits(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

type QueryValue = string | string[] | undefined;

function first(value: QueryValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function csv(value: QueryValue): string[] {
  const v = first(value);
  if (!v) return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function intOrNull(value: QueryValue): number | undefined {
  const v = first(value);
  if (v === undefined || v === '') return undefined;
  const n = Number(toAsciiDigits(v));
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function boolOrNull(value: QueryValue): boolean | undefined {
  const v = first(value);
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

/** URLSearchParams-ish objects → validated filters (falls back to defaults). */
export function parseFiltersFromSearchParams(params: Record<string, QueryValue>): SearchFilters {
  const raw: Record<string, unknown> = {
    brand: csv(params.brand),
    bodyType: csv(params.bodyType),
    gearbox: csv(params.gearbox),
    fuel: csv(params.fuel),
    plateType: csv(params.plateType),
    condition: csv(params.condition),
    city: csv(params.city),
    bikeType: csv(params.bikeType),
    heavyType: csv(params.heavyType),
    insurance: csv(params.insurance),
    paintCondition: csv(params.paintCondition),
    chassisCondition: csv(params.chassisCondition),
    hasReport: boolOrNull(params.hasReport) ?? false,
    kishOnly: boolOrNull(params.kishOnly) ?? false,
  };

  const model = first(params.model)?.trim();
  if (model) raw.model = model;

  const trim = first(params.trim)?.trim();
  if (trim) raw.trim = trim;

  const q = first(params.q)?.trim();
  if (q) raw.q = toAsciiDigits(q);

  const inspection = first(params.technicalInspection);
  if (inspection === 'yes' || inspection === 'no') raw.technicalInspection = inspection;

  for (const key of [
    'yearFrom',
    'yearTo',
    'priceFrom',
    'priceTo',
    'mileageMin',
    'mileageMax',
    'engineCcMin',
    'engineCcMax',
    'workingHoursMax',
  ] as const) {
    const n = intOrNull(params[key]);
    if (n !== undefined) raw[key] = n;
  }

  const parsed = searchFiltersSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_FILTERS; // invalid URL → unfiltered list
  return parsed.data;
}

/** Filters → URL query object; empty/default values are omitted. */
export function filtersToSearchParams(filters: SearchFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.brand.length) out.brand = filters.brand.join(',');
  if (filters.bodyType.length) out.bodyType = filters.bodyType.join(',');
  if (filters.model) out.model = filters.model;
  if (filters.trim) out.trim = filters.trim;
  if (filters.yearFrom !== undefined) out.yearFrom = String(filters.yearFrom);
  if (filters.yearTo !== undefined) out.yearTo = String(filters.yearTo);
  if (filters.priceFrom !== undefined) out.priceFrom = String(filters.priceFrom);
  if (filters.priceTo !== undefined) out.priceTo = String(filters.priceTo);
  if (filters.mileageMin !== undefined) out.mileageMin = String(filters.mileageMin);
  if (filters.mileageMax !== undefined) out.mileageMax = String(filters.mileageMax);
  if (filters.insurance.length) out.insurance = filters.insurance.join(',');
  if (filters.paintCondition.length) out.paintCondition = filters.paintCondition.join(',');
  if (filters.chassisCondition.length) out.chassisCondition = filters.chassisCondition.join(',');
  if (filters.technicalInspection) out.technicalInspection = filters.technicalInspection;
  if (filters.gearbox.length) out.gearbox = filters.gearbox.join(',');
  if (filters.fuel.length) out.fuel = filters.fuel.join(',');
  if (filters.plateType.length) out.plateType = filters.plateType.join(',');
  if (filters.condition.length) out.condition = filters.condition.join(',');
  if (filters.city.length) out.city = filters.city.join(',');
  if (filters.engineCcMin !== undefined) out.engineCcMin = String(filters.engineCcMin);
  if (filters.engineCcMax !== undefined) out.engineCcMax = String(filters.engineCcMax);
  if (filters.bikeType.length) out.bikeType = filters.bikeType.join(',');
  if (filters.heavyType.length) out.heavyType = filters.heavyType.join(',');
  if (filters.workingHoursMax !== undefined) out.workingHoursMax = String(filters.workingHoursMax);
  if (filters.hasReport) out.hasReport = 'true';
  if (filters.kishOnly) out.kishOnly = 'true';
  if (filters.q) out.q = filters.q;
  return out;
}

export function serializeFilters(filters: SearchFilters): string {
  const params = new URLSearchParams(filtersToSearchParams(filters));
  return params.toString();
}

export function parseFilterQueryString(query: string): SearchFilters {
  return parseFiltersFromSearchParams(Object.fromEntries(new URLSearchParams(query)));
}

/** Flat payload for the `search_listings(filters jsonb)` RPC. */
export function filtersToRpcPayload(filters: SearchFilters): Record<string, string | boolean> {
  const payload: Record<string, string | boolean> = {};
  const params = filtersToSearchParams(filters);
  for (const [k, v] of Object.entries(params)) payload[k] = v;
  return payload;
}

export function activeFilterCount(filters: SearchFilters): number {
  return (
    filters.brand.length +
    filters.bodyType.length +
    filters.gearbox.length +
    filters.fuel.length +
    filters.plateType.length +
    filters.condition.length +
    filters.city.length +
    filters.bikeType.length +
    filters.heavyType.length +
    (filters.model ? 1 : 0) +
    (filters.trim ? 1 : 0) +
    (filters.yearFrom !== undefined || filters.yearTo !== undefined ? 1 : 0) +
    (filters.priceFrom !== undefined || filters.priceTo !== undefined ? 1 : 0) +
    (filters.mileageMin !== undefined || filters.mileageMax !== undefined ? 1 : 0) +
    (filters.insurance.length ? 1 : 0) +
    (filters.paintCondition.length ? 1 : 0) +
    (filters.chassisCondition.length ? 1 : 0) +
    (filters.technicalInspection !== undefined ? 1 : 0) +
    (filters.engineCcMin !== undefined || filters.engineCcMax !== undefined ? 1 : 0) +
    (filters.workingHoursMax !== undefined ? 1 : 0) +
    (filters.hasReport ? 1 : 0) +
    (filters.kishOnly ? 1 : 0) +
    (filters.q ? 1 : 0)
  );
}

export const BRAND_LABELS = BRAND_NAME;
export const CITY_LABELS = Object.fromEntries(CITIES.map((c) => [c.slug, c.label]));
