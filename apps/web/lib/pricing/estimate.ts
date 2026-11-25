import {
  searchFiltersSchema,
  type SearchFilters,
  type VehicleCategory,
} from '@alisales/schemas';
import { searchPublicListings, type ListingCardData } from '@/lib/data/listings';

/**
 * «قیمت پیشنهادی بازار» — a comparable-price estimate for the listing form.
 *
 * The estimate is read from the same public catalogue the grid shows, so it can
 * never quote a range the site does not actually have:
 *
 *  1. `comparables` — same brand, model-text, year (±1) and plate class;
 *  2. `brand` — no exact model comps yet, so the brand's own year window is
 *     used as a reference range;
 *  3. `none` — nothing to compare against, so the form shows a plain message
 *     instead of an invented number.
 *
 * It is deliberately one function with one shape: swapping in an external
 * pricing API later means replacing the body of `estimateListingPrice`, not
 * touching the route or the form.
 */

export type PriceEstimateSource = 'comparables' | 'brand' | 'none';

export interface PriceEstimate {
  source: PriceEstimateSource;
  /** How many listings the range was computed from. */
  count: number;
  minIRR: number | null;
  avgIRR: number | null;
  maxIRR: number | null;
}

export interface PriceEstimateInput {
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  plateType?: string | null;
  category: VehicleCategory;
}

/** How many comps one estimate reads; the catalogue's own page cap. */
const COMP_LIMIT = 100;
/** Model years either side of the chosen one, so a sparse year still has comps. */
const YEAR_SPREAD = 1;

const EMPTY: PriceEstimate = { source: 'none', count: 0, minIRR: null, avgIRR: null, maxIRR: null };

function summarize(rows: readonly ListingCardData[], source: PriceEstimateSource): PriceEstimate | null {
  const prices = rows
    .map((row) => row.priceIRR)
    .filter((price) => Number.isFinite(price) && price > 0)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const total = prices.reduce((sum, price) => sum + price, 0);
  return {
    source,
    count: prices.length,
    minIRR: prices[0] ?? null,
    avgIRR: Math.round(total / prices.length),
    maxIRR: prices[prices.length - 1] ?? null,
  };
}

async function readComps(
  filters: Record<string, unknown>,
  category: VehicleCategory,
): Promise<ListingCardData[]> {
  const parsed = searchFiltersSchema.safeParse(filters);
  if (!parsed.success) return [];
  return searchPublicListings(parsed.data as SearchFilters, category, {
    limit: COMP_LIMIT,
    offset: 0,
  });
}

export async function estimateListingPrice(input: PriceEstimateInput): Promise<PriceEstimate> {
  const brand = input.brand && input.brand !== 'other' ? input.brand : null;
  const model = input.model?.trim() || null;
  const plateType = input.plateType || null;
  const year = Number.isFinite(input.year) ? Number(input.year) : null;

  const base: Record<string, unknown> = {
    ...(brand ? { brand: [brand] } : {}),
    ...(plateType ? { plateType: [plateType] } : {}),
    ...(year ? { yearFrom: year - YEAR_SPREAD, yearTo: year + YEAR_SPREAD } : {}),
  };

  if (!brand && !model && !year) return EMPTY;

  // Exact model comps first; a brand-only window is the documented fallback.
  for (const [filters, source] of [
    [{ ...base, ...(model ? { model } : {}) }, 'comparables'],
    [base, 'brand'],
  ] as const) {
    const estimate = summarize(await readComps(filters, input.category), source);
    if (estimate) return estimate;
  }
  return EMPTY;
}
