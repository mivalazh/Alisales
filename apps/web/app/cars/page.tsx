import type { Metadata } from 'next';
import Link from 'next/link';
import { DEFAULT_FILTERS, parseFiltersFromSearchParams } from '@alisales/schemas';
import { CarsCatalog } from '@/components/CarsCatalog';
import { Icon } from '@/components/Icon';
import { filterByBodyType, parseBodyType } from '@/lib/browse';
import { searchListings } from '@/lib/data/listings';
import { approvedStories } from '@/lib/data/moderation';
import { storiesFrom } from '@/lib/stories';
import { parseSortKey } from '@/lib/sort';

export const metadata: Metadata = {
  title: 'خودروها',
  description: 'جستجوی خودروهای نو و کارکرده در کیش — با فیلتر برند، سال، قیمت و پلاک.',
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Editorial vehicle highs for the car story rail (approved ones come first). */
const CAR_STORIES = [
  'land-cruiser-kish',
  'patrol-platinum-kish',
  's-class-kish',
  'cayenne-kish',
  'huracan-showroom',
] as const;

/**
 * Dedicated «خودرو» browse page, in the OpenSooq order:
 *
 *   search → filter pills (+ full filter modal) → brand emblem box with
 *   models → circular vehicle stories → sort/view → vehicle grid.
 *
 * The brand box is the filter control itself: a brand tap commits `?brand=` and
 * opens that marque's model row, a model tap narrows the grid immediately.
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

  // Two reads: the filtered result the grid renders, and the unfiltered vehicle
  // pool behind the live filter count.
  const [base, pool, approved] = await Promise.all([
    searchListings(filters),
    searchListings(DEFAULT_FILTERS),
    approvedStories(),
  ]);
  const vehicles = base.filter((listing) => listing.kind !== 'part');
  const listings = body ? filterByBodyType(vehicles, body) : vehicles;

  const vehiclePool = pool.filter((listing) => listing.kind !== 'part');
  const stories = storiesFrom(vehiclePool, approved, CAR_STORIES, 6);

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

      <CarsCatalog
        listings={listings}
        pool={vehiclePool}
        filters={filters}
        sort={sort}
        stories={stories}
      />
    </div>
  );
}
