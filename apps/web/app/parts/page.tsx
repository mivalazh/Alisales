import { localizedMetadata } from '@/lib/i18n/metadata';
import { DEFAULT_FILTERS, parseFiltersFromSearchParams } from '@alisales/schemas';
import { PartsCatalog } from '@/components/PartsCatalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import {
  filterByPartCategory,
  filterPartsByAttributes,
  parsePartCategory,
} from '@/lib/browse';
import { getSession } from '@/lib/auth/session';
import { followedSellerIds } from '@/lib/data/social-store';
import { boostFollowed } from '@/lib/follow-priority';
import { searchListings } from '@/lib/data/listings';
import { approvedStories } from '@/lib/data/moderation';
import { storiesFrom } from '@/lib/stories';
import { parseSortKey } from '@/lib/sort';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'قطعات و لوازم یدکی', description: 'قطعات و لوازم یدکی خودروهای وارداتی در کیش — با فیلتر دسته‌بندی، منشأ و سازگاری.' },
  { title: 'Spare Parts & Accessories', description: 'Imported-car spare parts and accessories in Kish — filter by category, origin and compatibility.' },
);

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Editorial parts highs for the parts rail (approved ones come first). */
const PART_STORIES = [
  'porsche-ceramic-brake-kit',
  'land-cruiser-gearbox-part',
  's-class-body-kit',
  'bmw-turbocharger',
  'cayenne-brake-kit-part',
] as const;

/**
 * Dedicated «قطعات و لوازم یدکی» page. Deliberately *not* the car layout: no
 * brand box, because parts buyers shop by category, condition and origin.
 *
 *   category switch → search → circular parts stories → category pills +
 *   condition/origin/warranty/compatibility strip → sort/view → parts grid.
 */
export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const v = first(value);
    if (v !== undefined) raw[key] = v;
  }

  const filters = parseFiltersFromSearchParams(raw);
  const sort = parseSortKey(first(params.sort));
  const category = parsePartCategory(first(params.category));
  const origin = first(params.origin) ?? null;
  const warranty = first(params.warranty) === '1';
  const compatibility = first(params.compat) ?? '';
  // «وضعیت قطعه» is its own three-state parts control (new / stock / used) and
  // deliberately separate from the vehicle condition filter.
  const condition = first(params.pcond) ?? null;

  const [session, lang] = await Promise.all([getSession(), getLanguage()]);
  const t = (fa: string, en?: string) => serverT(lang, fa, en);
  const followed = followedSellerIds(session?.sub);
  const [base, pool, approved] = await Promise.all([
    searchListings(filters),
    searchListings(DEFAULT_FILTERS),
    approvedStories(),
  ]);

  const parts = base.filter((listing) => listing.kind === 'part');
  let listings = category ? filterByPartCategory(parts, category) : parts;
  listings = filterPartsByAttributes(listings, {
    origin,
    warrantyOnly: warranty,
    compatibility,
    condition,
  });

  const partPool = pool.filter((listing) => listing.kind === 'part');
  const stories = storiesFrom(partPool, approved, PART_STORIES, 6, followed);
  listings = boostFollowed(listings, followed);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold sm:text-2xl">{t('قطعات و لوازم یدکی')}</h1>

      <CategorySwitch />

      <PartsCatalog
        listings={listings}
        pool={partPool}
        filters={filters}
        sort={sort}
        stories={stories}
        category={category}
        origin={origin}
        warranty={warranty}
        compatibility={compatibility}
        condition={condition}
      />
    </div>
  );
}
