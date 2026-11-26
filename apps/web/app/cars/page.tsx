import { Suspense } from 'react';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { CategoryCatalog, CategoryCatalogFallback } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { searchPublicListings } from '@/lib/data/listings';
import { staticMetadata } from '@/lib/i18n/metadata';

/**
 * «خودرو» — statically generated, revalidated every minute.
 *
 * The pool is rendered once; brand/model, filters, sort and `?body=` are read
 * from the URL in the browser by `CategoryCatalog`, so the document carries no
 * per-request data and can be cached at the edge.
 */
export const revalidate = 60;

export const metadata = staticMetadata(
  { title: 'خودروها', description: 'جستجوی خودروهای نو و کارکرده در کیش — با فیلتر برند، سال، قیمت و پلاک.' },
  { title: 'Vehicles', description: 'Search new and used cars in Kish — filter by brand, year, price and plate.' },
  '/cars',
);

export default async function CarsPage() {
  const pool = await searchPublicListings(DEFAULT_FILTERS, 'car');
  // Only user-submitted stories reach the rail; listings are not stories.
  const stories: never[] = [];

  return (
    <div className="space-y-4">
      {/* The active tab in the strip below already says where the buyer is, so
          the page opens straight on the filter controls. Keep the h1 for screen
          readers and search engines without spending a row of height. */}
      <h1 className="sr-only">خودروها</h1>

      <CategorySwitch />

      <Suspense
        fallback={
          <CategoryCatalogFallback
            category="car"
            pool={pool}
            stories={stories}
            storiesLabel="داستان‌های خودرو"
            searchPlaceholder="جستجو در خودروها..."
            heading="خودرو"
          />
        }
      >
        <CategoryCatalog
          category="car"
          pool={pool}
          stories={stories}
          storiesLabel="داستان‌های خودرو"
          searchPlaceholder="جستجو در خودروها..."
          heading="خودرو"
        />
      </Suspense>
    </div>
  );
}
