import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { CategoryCatalog } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { filterByBodyType, parseBodyType } from '@/lib/browse';
import { loadCategoryPage } from '@/lib/category-page';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'خودروها', description: 'جستجوی خودروهای نو و کارکرده در کیش — با فیلتر برند، سال، قیمت و پلاک.' },
  { title: 'Vehicles', description: 'Search new and used cars in Kish — filter by brand, year, price and plate.' },
);

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
  const [{ listings, ...data }, lang] = await Promise.all([
    loadCategoryPage(params, 'car'),
    getLanguage(),
  ]);
  const t = (fa: string, en?: string) => serverT(lang, fa, en);
  const body = parseBodyType(first(params.body));
  const visible = body ? filterByBodyType(listings, body) : listings;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold sm:text-2xl">{t('خودروها', 'Vehicles')}</h1>
        <Link
          href="/parts"
          className="text-sm font-bold text-muted transition hover:text-ink"
        >
          {t('قطعات و لوازم یدکی')}
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
        storiesLabel={t('داستان‌های خودرو', 'Vehicle stories')}
        searchPlaceholder={t('جستجو در خودروها...', 'Search vehicles...')}
        heading={t('خودرو')}
      />
    </div>
  );
}
