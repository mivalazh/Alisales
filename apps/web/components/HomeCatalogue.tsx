'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PART_CATEGORY_LABELS } from '@alisales/schemas';
import type { ListingCardData } from '@/lib/data/listings';
import {
  byKind,
  filtersFromParams,
  visibleListings,
  type CatalogueParams,
} from '@/lib/catalogue';
import {
  filterByBodyType,
  filterByPartCategory,
  parseBodyType,
  parsePartCategory,
} from '@/lib/browse';
import { parseSortKey } from '@/lib/sort';
import { useCatalogueRows } from '@/lib/use-catalogue-rows';
import { RENTAL_URL } from '@/lib/seo';
import { useI18n } from '@/lib/i18n';
import { Catalog } from './Catalog';
import { CategorySwitch } from './CategorySwitch';
import type { StoryItem } from './Stories';

type Kind = 'vehicle' | 'part' | null;

function parseKind(value: string | null | undefined): Kind {
  return value === 'vehicle' || value === 'part' ? value : null;
}

/**
 * Home catalogue, filtered in the browser.
 *
 * The page is statically generated from the public pool, so the server render
 * cannot depend on `?q=`, `?brand=`, `?body=`, `?kind=` or `?sort=`. This
 * component reads them from the URL after hydration — the same URL the filters
 * commit to — which keeps one code path for the chips and the grid.
 *
 * `HomeCatalogueFallback` renders the identical shell with default filters, so
 * the prerendered HTML already contains the full catalogue (first paint and
 * crawlers both get real content) instead of an empty Suspense hole.
 */
type HomeCatalogueProps = {
  pool: ListingCardData[];
  /** Unfiltered pool for the category cards' counts (the static rows). */
  countPool?: ListingCardData[];
  stories: StoryItem[];
};

/** URL → the state this page renders. `null` resolves to the static defaults. */
function homeState(params: CatalogueParams) {
  return {
    filters: filtersFromParams(params),
    sort: parseSortKey(params?.get('sort')),
    kind: parseKind(params?.get('kind')),
    body: parseBodyType(params?.get('body')),
    category: parsePartCategory(params?.get('category')),
  };
}

function HomeCatalogueView({
  pool,
  countPool,
  stories,
  params,
  serverMatches = false,
}: HomeCatalogueProps & { params: CatalogueParams; serverMatches?: boolean }) {
  const { filters, sort, kind, body, category } = homeState(params);
  const { t } = useI18n();

  // Server rows already matched the URL (its q reads more fields than the local
  // predicate), so only `kind` / `body` / part category narrow them here.
  const base = serverMatches ? pool : visibleListings(pool, filters);
  let listings = byKind(base, kind);
  if (body) listings = filterByBodyType(listings, body);
  if (category) listings = filterByPartCategory(listings, category);
  // Card counts describe the catalogue, not the current filter, so they stay
  // on the unfiltered pool while the grid shows the URL's matches.
  const counts = countPool ?? pool;
  const vehicleCount = counts.filter((listing) => listing.kind !== 'part').length;
  const partCount = counts.filter((listing) => listing.kind === 'part').length;
  const groupLabel = body ? t(body.label) : category ? t(PART_CATEGORY_LABELS[category]) : null;
  const kindLabel =
    kind === 'vehicle'
      ? t('خودرو', 'Vehicles')
      : kind === 'part'
        ? t('قطعات و لوازم یدکی', 'Spare Parts & Accessories')
        : null;

  return (
    <>
      <div className="mb-3 mt-3 sm:mt-4">
        <CategorySwitch />
      </div>
      <a
        href={RENTAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t(
          'پورتال رنت خودرو، موتور و یات کیش — به‌زودی در rent.alisales.ir',
          'Kish car, bike and jet-ski rental portal — coming soon at rent.alisales.ir',
        )}
        className="mb-3 flex items-center gap-3 rounded-2xl border border-[#c5dc1e]/70 bg-[#DEF434]/20 px-3 py-2.5 transition hover:border-[#c5dc1e] hover:bg-[#DEF434]/30 dark:border-[#DEF434]/25 dark:bg-[#DEF434]/10"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DEF434] text-sm font-black text-[#111144] shadow-sm">
          R
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-extrabold text-ink sm:text-sm">
            {t(
              'پورتال رنت خودرو، موتور و یات کیش',
              'Kish car, bike and jet-ski rental portal',
            )}
          </span>
          <span className="mt-0.5 block text-[10px] font-bold text-muted sm:text-[11px]">
            {t('به‌زودی در rent.alisales.ir', 'Coming Soon at rent.alisales.ir')}
          </span>
        </span>
        <span className="hidden shrink-0 rounded-full bg-[#DEF434] px-2.5 py-1 text-[10px] font-extrabold text-[#111144] sm:inline-flex">
          {t('رنت', 'Rent')}
        </span>
      </a>
      {(groupLabel || kindLabel) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-[var(--radius-pill)] border border-cta bg-cta-soft px-3 py-1.5 text-xs font-extrabold text-ink">
            {groupLabel ?? kindLabel}
          </span>
          <Link
            href="/"
            className="inline-flex min-h-9 items-center rounded-full border border-line bg-card px-3 py-1.5 text-xs font-bold text-ink transition hover:border-line-strong"
          >
            {t('حذف دسته‌بندی', 'Clear category')}
          </Link>
        </div>
      )}
      <Catalog
        listings={listings}
        filters={filters}
        sort={sort}
        stories={stories}
        kind={kind}
        vehicleCount={vehicleCount}
        partCount={partCount}
        sortBar="bottom"
      />
    </>
  );
}

/** URL-driven version (after hydration). */
export function HomeCatalogue({ pool: staticPool, stories }: HomeCatalogueProps) {
  const params = useSearchParams();
  // After hydration the full matching pool replaces the rendered first 48.
  const { rows, serverMatches } = useCatalogueRows(staticPool, filtersFromParams(params));
  return (
    <HomeCatalogueView
      pool={rows}
      countPool={staticPool}
      stories={stories}
      params={params}
      serverMatches={serverMatches}
    />
  );
}

/**
 * Static-shell version: identical markup with the default filter set. This is
 * what the prerender (and the CDN) serves, so the page is never blank.
 */
export function HomeCatalogueFallback(props: HomeCatalogueProps) {
  return <HomeCatalogueView {...props} params={null} />;
}
