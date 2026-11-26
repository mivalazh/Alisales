import { Suspense } from 'react';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { CategoryCatalog, CategoryCatalogFallback } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { searchPublicListings } from '@/lib/data/listings';
import { staticMetadata } from '@/lib/i18n/metadata';

/** «ماشین‌آلات سنگین» — static pool, URL-driven filters (see /cars). */
export const revalidate = 60;

export const metadata = staticMetadata(
  { title: 'ماشین‌آلات سنگین', description: 'کامیون، کشنده، تریلی و ماشین‌آلات راه‌سازی — فیلتر برند، نوع، سال و ساعت کارکرد.' },
  { title: 'Heavy Machinery', description: 'Trucks, tractor units, trailers and road-building machinery — filter by brand, type, year and operating hours.' },
  '/heavy',
);

export default async function HeavyPage() {
  const pool = await searchPublicListings(DEFAULT_FILTERS, 'heavy');
  // Only user-submitted stories reach the rail; listings are not stories.
  const stories: never[] = [];

  return (
    <div className="space-y-4">
      <h1 className="sr-only">ماشین‌آلات سنگین</h1>

      <CategorySwitch />

      <Suspense
        fallback={
          <CategoryCatalogFallback
            category="heavy"
            pool={pool}
            stories={stories}
            storiesLabel="داستان‌های ماشین‌آلات"
            searchPlaceholder="جستجوی برند، مدل یا نوع ماشین‌آلات..."
            heading="ماشین‌آلات"
          />
        }
      >
        <CategoryCatalog
          category="heavy"
          pool={pool}
          stories={stories}
          storiesLabel="داستان‌های ماشین‌آلات"
          searchPlaceholder="جستجوی برند، مدل یا نوع ماشین‌آلات..."
          heading="ماشین‌آلات"
        />
      </Suspense>
    </div>
  );
}
