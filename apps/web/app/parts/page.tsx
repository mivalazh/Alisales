import { Suspense } from 'react';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { PartsCatalog, PartsCatalogFallback } from '@/components/PartsCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import { searchPublicListings } from '@/lib/data/listings';
import { approvedStories } from '@/lib/data/moderation';
import { storiesFrom } from '@/lib/stories';
import { staticMetadata } from '@/lib/i18n/metadata';

/**
 * «قطعات و لوازم یدکی» — statically generated parts pool.
 *
 * Category, origin, warranty, compatibility and condition all live in the URL
 * and are applied by `PartsCatalog` in the browser, so the document is the same
 * for every visitor.
 */
export const revalidate = 60;

export const metadata = staticMetadata(
  { title: 'قطعات و لوازم یدکی', description: 'قطعات و لوازم یدکی خودروهای وارداتی در کیش — با فیلتر دسته‌بندی، منشأ و سازگاری.' },
  { title: 'Spare Parts & Accessories', description: 'Imported-car spare parts and accessories in Kish — filter by category, origin and compatibility.' },
);

/** Editorial parts highs for the parts rail (approved ones come first). */
const PART_STORIES = [
  'porsche-ceramic-brake-kit',
  'land-cruiser-gearbox-part',
  's-class-body-kit',
  'bmw-turbocharger',
  'cayenne-brake-kit-part',
] as const;

export default async function PartsPage() {
  const [pool, approved] = await Promise.all([
    searchPublicListings(DEFAULT_FILTERS),
    approvedStories(),
  ]);
  const parts = pool.filter((listing) => listing.kind === 'part');
  const stories = storiesFrom(parts, approved, PART_STORIES, 6);

  return (
    <div className="space-y-4">
      {/* The active tab in the strip below already says where the buyer is; the
          heading stays available to screen readers and search engines only. */}
      <h1 className="sr-only">قطعات و لوازم یدکی</h1>

      <CategorySwitch />

      <Suspense fallback={<PartsCatalogFallback pool={parts} stories={stories} />}>
        <PartsCatalog pool={parts} stories={stories} />
      </Suspense>
    </div>
  );
}
