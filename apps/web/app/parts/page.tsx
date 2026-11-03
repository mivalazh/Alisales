import type { Metadata } from 'next';
import Link from 'next/link';
import { PART_CATEGORY_LABELS, parseFiltersFromSearchParams } from '@alisales/schemas';
import { Catalog } from '@/components/Catalog';
import { Icon } from '@/components/Icon';
import { filterByPartCategory, parsePartCategory } from '@/lib/browse';
import { searchListings } from '@/lib/data/listings';
import { parseSortKey } from '@/lib/sort';

export const metadata: Metadata = {
  title: 'قطعات و لوازم یدکی',
  description: 'قطعات و لوازم یدکی خودروهای وارداتی در کیش — با فیلتر دسته‌بندی، منشأ و سازگاری.',
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Dedicated «قطعات و لوازم یدکی» browse page — the parts card's destination.
 * Same catalog shell as the cars page, scoped to `kind: part` and to the
 * requested part category.
 */
export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const v = first(value);
    if (v !== undefined) raw[key] = v;
  }

  const filters = parseFiltersFromSearchParams(raw);
  const sort = parseSortKey(first(params.sort));
  const category = parsePartCategory(first(params.category));

  const base = await searchListings(filters);
  const parts = base.filter((listing) => listing.kind === 'part');
  const listings = category ? filterByPartCategory(parts, category) : parts;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">قطعات و لوازم یدکی</h1>
          <p className="mt-1 text-sm text-muted">
            {category ? PART_CATEGORY_LABELS[category] : 'قطعات اصلی و استوک برای خودروهای وارداتی'}{' '}
            · {listings.length.toLocaleString('en-US')} آگهی
          </p>
        </div>
        <Link
          href="/cars"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink"
        >
          <Icon name="car" size={16} />
          خودروها
        </Link>
      </div>

      <Catalog
        listings={listings}
        filters={filters}
        sort={sort}
        basePath="/parts"
        kind="part"
        showCategories={false}
        showStories={false}
        searchPlaceholder="جستجوی قطعه، شماره فنی یا برند"
      />
    </div>
  );
}
