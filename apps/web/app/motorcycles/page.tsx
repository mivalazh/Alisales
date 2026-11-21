import { localizedMetadata } from '@/lib/i18n/metadata';
import { CategoryCatalog } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { loadCategoryPage } from '@/lib/category-page';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

/** One-minute catalogue cache window; see the note in app/page.tsx. */
export const revalidate = 60;

export const generateMetadata = localizedMetadata(
  { title: 'موتور و اسکوتر برقی', description: 'خرید و فروش موتور و اسکوتر برقی و بنزینی در کیش — فیلتر برند، نوع موتور، توان و سال.' },
  { title: 'Scooters & Bikes', description: 'Buy and sell electric and petrol scooters and motorcycles in Kish — filter by brand, type, power and year.' },
);

type SearchParams = Record<string, string | string[] | undefined>;

/** «موتور و اسکوتر برقی» — its own brand set, its own fields (class + cc/power). */
export default async function MotorcyclesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [{ listings, ...data }, lang] = await Promise.all([
    loadCategoryPage(params, 'motorcycle'),
    getLanguage(),
  ]);
  const t = (fa: string, en?: string) => serverT(lang, fa, en);

  return (
    <div className="space-y-4">
      {/* The active tab in the strip below already says where the buyer is, so
          the page opens straight on the filter controls. The heading stays for
          screen readers and search engines, with no visible block. */}
      <h1 className="sr-only">{t('موتور و اسکوتر برقی', 'Scooters & bikes')}</h1>

      <CategorySwitch />

      <CategoryCatalog
        category="motorcycle"
        listings={listings}
        pool={data.pool}
        filters={data.filters}
        sort={data.sort}
        stories={data.stories}
        storiesLabel={t('داستان‌های موتور و اسکوتر', 'Bike & scooter stories')}
        searchPlaceholder={t('جستجوی برند، مدل یا حجم موتور...', 'Search brands, models or engine size...')}
        heading={t('موتور و اسکوتر')}
      />
    </div>
  );
}
