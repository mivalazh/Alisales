import { z } from 'zod';
import { conditions, gearboxTypes, plateTypes } from './enums';
import { BRANDS, CITIES, brandSlugs } from './vehicle';

/**
 * Search filters — the URL is the source of truth on web, and the same shape
 * is passed to the `search_listings` RPC (single filter implementation in DB).
 */
const citySlugsTuple = CITIES.map((c) => c.slug) as [string, ...string[]];

export const searchFiltersSchema = z.object({
  brand: z.array(z.enum(brandSlugs)).default([]),
  model: z.string().trim().min(1).max(60).optional(),
  yearFrom: z.number().int().min(1300).max(1420).optional(),
  yearTo: z.number().int().min(1300).max(1420).optional(),
  priceFrom: z.number().int().min(0).max(10 ** 15).optional(),
  priceTo: z.number().int().min(0).max(10 ** 15).optional(),
  mileageMax: z.number().int().min(0).max(2_000_000).optional(),
  gearbox: z.array(z.enum(gearboxTypes)).default([]),
  plateType: z.array(z.enum(plateTypes)).default([]),
  condition: z.array(z.enum(conditions)).default([]),
  city: z.array(z.enum(citySlugsTuple)).default([]),
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
    gearbox: csv(params.gearbox),
    plateType: csv(params.plateType),
    condition: csv(params.condition),
    city: csv(params.city),
    hasReport: boolOrNull(params.hasReport) ?? false,
    kishOnly: boolOrNull(params.kishOnly) ?? false,
  };

  const model = first(params.model)?.trim();
  if (model) raw.model = model;

  const q = first(params.q)?.trim();
  if (q) raw.q = toAsciiDigits(q);

  for (const key of ['yearFrom', 'yearTo', 'priceFrom', 'priceTo', 'mileageMax'] as const) {
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
  if (filters.model) out.model = filters.model;
  if (filters.yearFrom !== undefined) out.yearFrom = String(filters.yearFrom);
  if (filters.yearTo !== undefined) out.yearTo = String(filters.yearTo);
  if (filters.priceFrom !== undefined) out.priceFrom = String(filters.priceFrom);
  if (filters.priceTo !== undefined) out.priceTo = String(filters.priceTo);
  if (filters.mileageMax !== undefined) out.mileageMax = String(filters.mileageMax);
  if (filters.gearbox.length) out.gearbox = filters.gearbox.join(',');
  if (filters.plateType.length) out.plateType = filters.plateType.join(',');
  if (filters.condition.length) out.condition = filters.condition.join(',');
  if (filters.city.length) out.city = filters.city.join(',');
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
    filters.gearbox.length +
    filters.plateType.length +
    filters.condition.length +
    filters.city.length +
    (filters.model ? 1 : 0) +
    (filters.yearFrom !== undefined || filters.yearTo !== undefined ? 1 : 0) +
    (filters.priceFrom !== undefined || filters.priceTo !== undefined ? 1 : 0) +
    (filters.mileageMax !== undefined ? 1 : 0) +
    (filters.hasReport ? 1 : 0) +
    (filters.kishOnly ? 1 : 0) +
    (filters.q ? 1 : 0)
  );
}

export const BRAND_LABELS = Object.fromEntries(BRANDS.map((b) => [b.slug, b.label]));
export const CITY_LABELS = Object.fromEntries(CITIES.map((c) => [c.slug, c.label]));
