import type { ListingCardData } from './data/listings';

/**
 * User-facing sort options for the catalog. Every option keeps sold listings
 * anchored after every active one — the product rule lives in `sortListings`.
 *
 * `newest` is the default browse ranking (featured bumps first, then recency);
 * it is still an explicit option so the control always shows the current state.
 */
export type SortKey = 'newest' | SortOptionKey;

export const SORT_OPTION_KEYS = ['newest', 'priceAsc', 'priceDesc', 'mostViewed'] as const;
export type SortOptionKey = (typeof SORT_OPTION_KEYS)[number];

export const SORT_LABELS: Record<SortOptionKey, string> = {
  newest: 'جدیدترین',
  priceAsc: 'ارزان‌ترین',
  priceDesc: 'گران‌ترین',
  mostViewed: 'پربازدیدترین',
};

/** Parseable values — the full option set, so legacy `?sort=` URLs keep working. */
export const SORT_KEYS = SORT_OPTION_KEYS;

export function parseSortKey(value: string | null | undefined): SortKey {
  return (SORT_KEYS as readonly string[]).includes(value ?? '') ? (value as SortKey) : 'newest';
}

function recency(a: ListingCardData, b: ListingCardData): number {
  const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
  const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
  return bt - at;
}

/**
 * UI sort — the search RPC already returns sold-last, but the dev/fixture path
 * and any client-side re-sort must preserve the same product rule: sold
 * listings always sit after every active one, within their own group keeping
 * the chosen order.
 */
export function sortListings<T extends ListingCardData>(list: readonly T[], key: SortKey): T[] {
  const cmp = (a: T, b: T): number => {
    const aSold = a.state === 'sold' ? 1 : 0;
    const bSold = b.state === 'sold' ? 1 : 0;
    if (aSold !== bSold) return aSold - bSold; // sold last, always
    if (key === 'priceAsc') return a.priceIRR - b.priceIRR || recency(a, b);
    if (key === 'priceDesc') return b.priceIRR - a.priceIRR || recency(a, b);
    if (key === 'mostViewed') {
      // Listings without a count (hosted cards before the RPC returns one)
      // rank as zero rather than jumping ahead.
      return (b.views ?? 0) - (a.views ?? 0) || recency(a, b);
    }
    // newest (default browse ranking): active bumps / featured first, then
    // recency; missing publishedAt falls back to the source list order.
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return recency(a, b);
  };
  return [...list].sort(cmp);
}
