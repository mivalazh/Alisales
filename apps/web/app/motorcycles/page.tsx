import type { Metadata } from 'next';
import { CategoryCatalog } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { loadCategoryPage } from '@/lib/category-page';

export const metadata: Metadata = {
  title: 'موتور و اسکوتر برقی',
  description:
    'خرید و فروش موتور و اسکوتر برقی و بنزینی در کیش — فیلتر برند، نوع موتور، توان و سال.',
};

type SearchParams = Record<string, string | string[] | undefined>;

/** «موتور و اسکوتر برقی» — its own brand set, its own fields (class + cc/power). */
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
        <h1 className="text-xl font-extrabold sm:text-2xl">موتور و اسکوتر برقی</h1>
        <p className="mt-1 text-sm text-muted">
          اسکوتر برقی، موتور برقی، اسپرت و کلاسیک · {listings.length.toLocaleString('en-US')} آگهی
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
        storiesLabel="داستان‌های موتور و اسکوتر"
        searchPlaceholder="جستجوی برند، مدل یا حجم موتور..."
        heading="موتور و اسکوتر"
      />
    </div>
  );
}
