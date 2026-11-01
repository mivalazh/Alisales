import type { ListingOwnerStats } from './stats';

/**
 * Owner statistics ordering (`/profile/stats?sort=…`).
 *
 * «بیشترین تماس» is an ordering key only: it ranks by phone reveals plus
 * started chats, while the table keeps the two counters displayed separately
 * (the product rule forbids merging them into one visible number).
 */
export const OWNER_STATS_SORTS = ['newest', 'views', 'contacts'] as const;
export type OwnerStatsSort = (typeof OWNER_STATS_SORTS)[number];

export const OWNER_STATS_SORT_LABELS: Record<OwnerStatsSort, string> = {
  newest: 'تازه‌ترین',
  views: 'بیشترین بازدید',
  contacts: 'بیشترین تماس',
};

export function parseOwnerStatsSort(value: string | null | undefined): OwnerStatsSort {
  return (OWNER_STATS_SORTS as readonly string[]).includes(value ?? '')
    ? (value as OwnerStatsSort)
    : 'newest';
}

/** Stable sort: chosen key desc, then views desc, then listing id for ties. */
export function sortOwnerStats(
  rows: readonly ListingOwnerStats[],
  sort: OwnerStatsSort,
  publishedAtById: Readonly<Record<string, string | null | undefined>> = {},
): ListingOwnerStats[] {
  const contacts = (row: ListingOwnerStats): number => row.phoneReveals + row.chatStarts;
  const time = (row: ListingOwnerStats): number => {
    const value = publishedAtById[row.listingId];
    const parsed = value ? Date.parse(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return [...rows].sort((a, b) => {
    if (sort === 'views' && a.views !== b.views) return b.views - a.views;
    if (sort === 'contacts' && contacts(a) !== contacts(b)) return contacts(b) - contacts(a);
    if (sort === 'newest' && time(a) !== time(b)) return time(b) - time(a);
    if (a.views !== b.views) return b.views - a.views;
    return a.listingId.localeCompare(b.listingId);
  });
}
