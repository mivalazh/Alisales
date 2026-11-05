import type { Metadata } from 'next';
import Link from 'next/link';
import { CategoryCatalog } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { filterByBodyType, parseBodyType } from '@/lib/browse';
import { loadCategoryPage } from '@/lib/category-page';

export const metadata: Metadata = {
  title: 'خودروها',
  description: 'جستجوی خودروهای نو و کارکرده در کیش — با فیلتر برند، سال، قیمت و پلاک.',
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * «خودرو» — the vehicle category page.
 *
 * Top to bottom: category switch → search → brand box with its model row →
 * filters (sidebar on desktop, bottom sheet on phones) → car stories → chips →
 * sort/view → grid. The brand box is the filter control itself: a brand tap
 * commits `?brand=` and opens that marque's models.
 */
export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { listings, ...data } = await loadCategoryPage(params, 'car');
  const body = parseBodyType(first(params.body));
  const visible = body ? filterByBodyType(listings, body) : listings;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold sm:text-2xl">خودروها</h1>
          <p className="mt-1 text-sm text-muted">
            {body ? body.label : 'خودروهای کیش و سراسر ایران، وارداتی و پلاک‌دار'} ·{' '}
            {visible.length.toLocaleString('en-US')} آگهی
          </p>
        </div>
        <Link
          href="/parts"
          className="text-sm font-bold text-muted transition hover:text-ink"
        >
          قطعات و لوازم یدکی
        </Link>
      </div>

      <CategorySwitch />

      <CategoryCatalog
        category="car"
        listings={visible}
        pool={data.pool}
        filters={data.filters}
        sort={data.sort}
        stories={data.stories}
        storiesLabel="داستان‌های خودرو"
        searchPlaceholder="جستجو در خودروها..."
        heading="خودرو"
      />
    </div>
  );
}
