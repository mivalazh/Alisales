import { localizedMetadata } from '@/lib/i18n/metadata';
import { CategoryCatalog } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { loadCategoryPage } from '@/lib/category-page';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

/** One-minute catalogue cache window; see the note in app/page.tsx. */
export const revalidate = 60;

export const generateMetadata = localizedMetadata(
  { title: 'ماشین‌آلات سنگین', description: 'کامیون، کشنده، تریلی و ماشین‌آلات راه‌سازی — فیلتر برند، نوع، سال و ساعت کارکرد.' },
  { title: 'Heavy Machinery', description: 'Trucks, tractor units, trailers and road-building machinery — filter by brand, type, year and operating hours.' },
);

type SearchParams = Record<string, string | string[] | undefined>;

/** «ماشین‌آلات سنگین» — truck/heavy brands, type and working-hours filters. */
export default async function HeavyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [{ listings, ...data }, lang] = await Promise.all([
    loadCategoryPage(params, 'heavy'),
    getLanguage(),
  ]);
  const t = (fa: string, en?: string) => serverT(lang, fa, en);

  return (
    <div className="space-y-4">
      {/* The active tab in the strip below already says where the buyer is, so
          the page opens straight on the filter controls. The heading stays for
          screen readers and search engines, with no visible block. */}
      <h1 className="sr-only">{t('ماشین‌آلات سنگین', 'Heavy machinery')}</h1>

      <CategorySwitch />

      <CategoryCatalog
        category="heavy"
        listings={listings}
        pool={data.pool}
        filters={data.filters}
        sort={data.sort}
        stories={data.stories}
        storiesLabel={t('داستان‌های ماشین‌آلات', 'Machinery stories')}
        searchPlaceholder={t('جستجوی برند، مدل یا نوع ماشین‌آلات...', 'Search brands, models or machinery type...')}
        heading={t('ماشین‌آلات')}
      />
    </div>
  );
}
