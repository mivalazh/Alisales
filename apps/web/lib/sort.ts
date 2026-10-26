import type { ListingCardData } from './data/listings';

/**
 * User-facing sort options for the catalog (sold-last is enforced below).
 *
 * `newest` — featured first, then recency — is the default browse ranking and
 * mirrors the search RPC. Per the approved rule it is NOT a sort option: it
 * has no label and is not offered in the sort control, only applied.
 */
export type SortKey = 'newest' | SortOptionKey;

/** The only selectable sorts. The default order is deliberately absent. */
export const SORT_OPTION_KEYS = ['priceAsc', 'priceDesc'] as const;
export type SortOptionKey = (typeof SORT_OPTION_KEYS)[number];

export const SORT_LABELS: Record<SortOptionKey, string> = {
  priceAsc: 'ارزان‌ترین',
  priceDesc: 'گران‌ترین',
};

/** Parseable values — includes the unlabeled default. */
export const SORT_KEYS = ['newest', ...SORT_OPTION_KEYS] as const;

export function parseSortKey(value: string | null | undefined): SortKey {
  return (SORT_KEYS as readonly string[]).includes(value ?? '') ? (value as SortKey) : 'newest';
}

/**
 * UI sort — the search RPC already returns sold-last, but the dev/fixture
 * path and any client-side re-sort must preserve the same product rule:
 * sold listings always sit after every active one, within their own group
 * keeping the chosen order.
 */
export function sortListings<T extends ListingCardData>(list: readonly T[], key: SortKey): T[] {
  const cmp = (a: T, b: T): number => {
    const aSold = a.state === 'sold' ? 1 : 0;
    const bSold = b.state === 'sold' ? 1 : 0;
    if (aSold !== bSold) return aSold - bSold; // sold last, always
    if (key === 'priceAsc') return a.priceIRR - b.priceIRR;
    if (key === 'priceDesc') return b.priceIRR - a.priceIRR;
    // newest (default browse ranking): featured first, then recency; missing
    // publishedAt falls back to the source list order.
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return bt - at;
  };
  return [...list].sort(cmp);
}
