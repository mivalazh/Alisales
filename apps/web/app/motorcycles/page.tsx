import type { Metadata } from 'next';
import { CategoryCatalog } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { loadCategoryPage } from '@/lib/category-page';

export const metadata: Metadata = {
  title: 'موتورسیکلت',
  description: 'خرید و فروش موتورسیکلت در کیش و ایران — فیلتر برند، حجم موتور، نوع و سال.',
};

type SearchParams = Record<string, string | string[] | undefined>;

/** «موتورسیکلت» — its own brand set, its own fields (cc + class) and filters. */
export default async function MotorcyclesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { listings, ...data } = await loadCategoryPage(params, 'motorcycle');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold sm:text-2xl">موتورسیکلت</h1>
        <p className="mt-1 text-sm text-muted">
          موتورهای اسپرت، کلاسیک، اسکوتر و کراس · {listings.length.toLocaleString('en-US')} آگهی
        </p>
      </div>

      <CategorySwitch />

      <CategoryCatalog
        category="motorcycle"
        listings={listings}
        pool={data.pool}
        filters={data.filters}
        sort={data.sort}
        stories={data.stories}
        storiesLabel="داستان‌های موتورسیکلت"
        searchPlaceholder="جستجوی برند، مدل یا حجم موتور..."
        heading="موتورسیکلت"
      />
    </div>
  );
}
