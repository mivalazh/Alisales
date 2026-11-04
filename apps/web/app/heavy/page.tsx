import type { Metadata } from 'next';
import { CategoryCatalog } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { loadCategoryPage } from '@/lib/category-page';

export const metadata: Metadata = {
  title: 'ماشین‌آلات سنگین',
  description: 'کامیون، کشنده، تریلی و ماشین‌آلات راه‌سازی — فیلتر برند، نوع، سال و ساعت کارکرد.',
};

type SearchParams = Record<string, string | string[] | undefined>;

/** «ماشین‌آلات سنگین» — truck/heavy brands, type and working-hours filters. */
export default async function HeavyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { listings, ...data } = await loadCategoryPage(params, 'heavy');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold sm:text-2xl">ماشین‌آلات سنگین</h1>
        <p className="mt-1 text-sm text-muted">
          کامیون، کشنده، تریلی و ماشین‌آلات راه‌سازی · {listings.length.toLocaleString('en-US')} آگهی
        </p>
      </div>

      <CategorySwitch />

      <CategoryCatalog
        category="heavy"
        listings={listings}
        pool={data.pool}
        filters={data.filters}
        sort={data.sort}
        stories={data.stories}
        storiesLabel="داستان‌های ماشین‌آلات"
        searchPlaceholder="جستجوی برند، مدل یا نوع ماشین‌آلات..."
        heading="ماشین‌آلات"
      />
    </div>
  );
}
