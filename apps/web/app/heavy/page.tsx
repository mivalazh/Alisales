import { Suspense } from 'react';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { CategoryCatalog, CategoryCatalogFallback } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { searchPublicListings } from '@/lib/data/listings';
import { approvedStories } from '@/lib/data/moderation';
import { storiesFrom } from '@/lib/stories';
import { staticMetadata } from '@/lib/i18n/metadata';

/** «ماشین‌آلات سنگین» — static pool, URL-driven filters (see /cars). */
export const revalidate = 60;

export const metadata = staticMetadata(
  { title: 'ماشین‌آلات سنگین', description: 'کامیون، کشنده، تریلی و ماشین‌آلات راه‌سازی — فیلتر برند، نوع، سال و ساعت کارکرد.' },
  { title: 'Heavy Machinery', description: 'Trucks, tractor units, trailers and road-building machinery — filter by brand, type, year and operating hours.' },
);

const HEAVY_STORIES = [
  'volvo-fh16-kish',
  'scania-r500-kish',
  'caterpillar-320d-kish',
  'howo-a7-dump-kish',
] as const;

export default async function HeavyPage() {
  const [pool, approved] = await Promise.all([
    searchPublicListings(DEFAULT_FILTERS, 'heavy'),
    approvedStories(),
  ]);
  const stories = storiesFrom(pool, approved, HEAVY_STORIES, 6);

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
