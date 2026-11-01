import Link from 'next/link';
import { PART_CATEGORY_LABELS, parseFiltersFromSearchParams } from '@alisales/schemas';
import { Catalog } from '@/components/Catalog';
import {
  filterByBodyType,
  filterByPartCategory,
  parseBodyType,
  parsePartCategory,
} from '@/lib/browse';
import { searchListings } from '@/lib/data/listings';
import { parseSortKey } from '@/lib/sort';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Browse results. `?body=` / `?category=` come from the hamburger groups and
 * narrow the same one search implementation, so filters, sort and search keep
 * working inside the chosen group.
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

  const body = parseBodyType(first(params.body));
  const category = parsePartCategory(first(params.category));

  let listings = await searchListings(filters);
  if (body) listings = filterByBodyType(listings, body);
  if (category) listings = filterByPartCategory(listings, category);

  const groupLabel = body?.label ?? (category ? PART_CATEGORY_LABELS[category] : null);

  return (
    <>
      <h1 className="sr-only">آگهی‌های خودرو در کیش و سراسر ایران</h1>
      {groupLabel && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-[var(--radius-pill)] border border-cta bg-cta-soft px-3 py-1.5 text-xs font-extrabold text-ink">
            {groupLabel}
          </span>
          <Link href="/" className="text-xs font-bold text-muted underline">
            حذف دسته‌بندی
          </Link>
        </div>
      )}
      <Catalog listings={listings} filters={filters} sort={sort} />
    </>
  );
}
