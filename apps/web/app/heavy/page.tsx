import { localizedMetadata } from '@/lib/i18n/metadata';
import { CategoryCatalog } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { loadCategoryPage } from '@/lib/category-page';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

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
      <div>
        <h1 className="text-xl font-extrabold sm:text-2xl">{t('ماشین‌آلات سنگین')}</h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            `کامیون، کشنده، تریلی و ماشین‌آلات راه‌سازی · ${listings.length.toLocaleString('en-US')} آگهی`,
            `Trucks, tractor units, trailers and road machinery · ${listings.length.toLocaleString('en-US')} listings`,
          )}
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
        storiesLabel={t('داستان‌های ماشین‌آلات', 'Machinery stories')}
        searchPlaceholder={t('جستجوی برند، مدل یا نوع ماشین‌آلات...', 'Search brands, models or machinery type...')}
        heading={t('ماشین‌آلات')}
      />
    </div>
  );
}
