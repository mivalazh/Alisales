import type { Metadata } from 'next';
import Link from 'next/link';
import { parseFiltersFromSearchParams } from '@alisales/schemas';
import { Catalog } from '@/components/Catalog';
import { Icon } from '@/components/Icon';
import { filterByBodyType, parseBodyType } from '@/lib/browse';
import { searchListings } from '@/lib/data/listings';
import { parseSortKey } from '@/lib/sort';

export const metadata: Metadata = {
  title: 'خودروها',
  description: 'جستجوی خودروهای نو و کارکرده در کیش — با فیلتر برند، سال، قیمت و پلاک.',
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Dedicated «خودرو» browse page. The category cards on the home page land here
 * instead of switching a filter, so cars get their own title, search box and
 * full filter panel; the catalog itself is the same one search implementation.
 */
export default async function CarsPage({
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
  const body = parseBodyType(first(params.body));

  const base = await searchListings(filters);
  const vehicles = base.filter((listing) => listing.kind !== 'part');
  const listings = body ? filterByBodyType(vehicles, body) : vehicles;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">خودروها</h1>
          <p className="mt-1 text-sm text-muted">
            {body ? body.label : 'همه‌ی خودروهای کیش، وارداتی و پلاک‌دار'} ·{' '}
            {listings.length.toLocaleString('en-US')} آگهی
          </p>
        </div>
        <Link
          href="/parts"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink"
        >
          <Icon name="gear" size={16} />
          قطعات و لوازم یدکی
        </Link>
      </div>

      <Catalog
        listings={listings}
        filters={filters}
        sort={sort}
        basePath="/cars"
        kind="vehicle"
        showCategories={false}
        showStories={false}
        searchPlaceholder="جستجوی خودرو، برند یا مدل"
      />
    </div>
  );
}
