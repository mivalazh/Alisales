import Link from 'next/link';
import { PART_CATEGORY_LABELS, parseFiltersFromSearchParams } from '@alisales/schemas';
import { Catalog } from '@/components/Catalog';
import { CategorySwitch } from '@/components/CategorySwitch';
import type { CatalogKind } from '@/components/CategoryCards';
import {
  filterByBodyType,
  filterByPartCategory,
  parseBodyType,
  parsePartCategory,
} from '@/lib/browse';
import { getSession } from '@/lib/auth/session';
import { followedSellerIds } from '@/lib/data/social-store';
import { boostFollowed } from '@/lib/follow-priority';
import { searchListings } from '@/lib/data/listings';
import { approvedStories } from '@/lib/data/moderation';
import { storiesFrom } from '@/lib/stories';
import { parseSortKey } from '@/lib/sort';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseKind(value: string | undefined): CatalogKind {
  return value === 'vehicle' || value === 'part' ? value : null;
}

/** Approved demo highs for the story rail — one per luxury listing. */
const STORY_SLUGS = [
  'land-cruiser-kish',
  'patrol-platinum-kish',
  's-class-kish',
  'cayenne-kish',
] as const;

/**
 * Browse results. `?body=` / `?category=` come from the hamburger groups and
 * `?kind=` from the two headline cards; all three narrow the same one search
 * implementation, so filters, sort and search keep working inside the group.
 */
export default async function HomePage({
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
  const kind = parseKind(first(params.kind));

  const body = parseBodyType(first(params.body));
  const category = parsePartCategory(first(params.category));

  const session = await getSession();
  const followed = followedSellerIds(session?.sub);
  const [base, approved] = await Promise.all([searchListings(filters), approvedStories()]);
  let listings = base;
  if (kind) {
    listings = listings.filter((l) => (l.kind === 'part' ? 'part' : 'vehicle') === kind);
  }
  if (body) listings = filterByBodyType(listings, body);
  if (category) listings = filterByPartCategory(listings, category);
  // Followed showrooms lead the default feed; sort/filter stay intact inside
  // each group because the boost is a stable partition.
  listings = boostFollowed(listings, followed);

  const groupLabel = body?.label ?? (category ? PART_CATEGORY_LABELS[category] : null);
  const vehicleCount = base.filter((l) => l.kind !== 'part').length;
  const partCount = base.filter((l) => l.kind === 'part').length;
  const kindLabel = kind === 'vehicle' ? 'خودرو' : kind === 'part' ? 'قطعات و لوازم یدکی' : null;

  return (
    <>
      <h1 className="sr-only">آگهی‌های خودرو در کیش و سراسر ایران</h1>
      <div className="mb-3">
        <CategorySwitch />
      </div>
      {(groupLabel || kindLabel) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-[var(--radius-pill)] border border-cta bg-cta-soft px-3 py-1.5 text-xs font-extrabold text-ink">
            {groupLabel ?? kindLabel}
          </span>
          <Link href="/" className="text-xs font-bold text-muted underline">
            حذف دسته‌بندی
          </Link>
        </div>
      )}
      <Catalog
        listings={listings}
        filters={filters}
        sort={sort}
        stories={storiesFrom(base, approved, STORY_SLUGS, 4, followed)}
        kind={kind}
        vehicleCount={vehicleCount}
        partCount={partCount}
        sortBar="bottom"
      />
    </>
  );
}
