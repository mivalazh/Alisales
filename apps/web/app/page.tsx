import { parseFiltersFromSearchParams } from '@alisales/schemas';
import { Catalog } from '@/components/Catalog';
import { searchListings } from '@/lib/data/listings';
import { parseSortKey } from '@/lib/sort';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  // Raw string params → validated filters (invalid input falls back to none).
  const raw: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const v = first(value);
    if (v !== undefined) raw[key] = v;
  }
  const filters = parseFiltersFromSearchParams(raw);
  const sort = parseSortKey(first(params.sort));

  // The one search implementation (RPC with credentials, fixtures without).
  const listings = await searchListings(filters);

  return (
    <>
      <h1 className="sr-only">آگهی‌های خودرو در کیش و سراسر ایران</h1>
      <Catalog listings={listings} filters={filters} sort={sort} />
    </>
  );
}
