import { Suspense } from 'react';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { CategoryCatalog, CategoryCatalogFallback } from '@/components/CategoryCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { searchPublicListings } from '@/lib/data/listings';
import { staticMetadata } from '@/lib/i18n/metadata';

/** «موتور و اسکوتر برقی» — static pool, URL-driven filters (see /cars). */
export const revalidate = 60;

export const metadata = staticMetadata(
  { title: 'موتور و اسکوتر برقی', description: 'خرید و فروش موتور و اسکوتر برقی و بنزینی در کیش — فیلتر برند، نوع موتور، توان و سال.' },
  { title: 'Scooters & Bikes', description: 'Buy and sell electric and petrol scooters and motorcycles in Kish — filter by brand, type, power and year.' },
  '/motorcycles',
);

export default async function MotorcyclesPage() {
  const pool = await searchPublicListings(DEFAULT_FILTERS, 'motorcycle');
  // Only user-submitted stories reach the rail; listings are not stories.
  const stories: never[] = [];

  return (
    <div className="space-y-4">
      <h1 className="sr-only">موتور و اسکوتر برقی</h1>

      <CategorySwitch />

      <Suspense
        fallback={
          <CategoryCatalogFallback
            category="motorcycle"
            pool={pool}
            stories={stories}
            storiesLabel="داستان‌های موتور و اسکوتر"
            searchPlaceholder="جستجوی برند، مدل یا حجم موتور..."
            heading="موتور و اسکوتر"
          />
        }
      >
        <CategoryCatalog
          category="motorcycle"
          pool={pool}
          stories={stories}
          storiesLabel="داستان‌های موتور و اسکوتر"
          searchPlaceholder="جستجوی برند، مدل یا حجم موتور..."
          heading="موتور و اسکوتر"
        />
      </Suspense>
    </div>
  );
}
