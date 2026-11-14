import type { Metadata } from 'next';
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
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';
import { absoluteUrl, RENTAL_URL, SITE_URL } from '@/lib/seo';

type SearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: absoluteUrl('/') },
};

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

  const [session, lang] = await Promise.all([getSession(), getLanguage()]);
  const t = (fa: string, en?: string) => serverT(lang, fa, en);
  const followed = await followedSellerIds(session?.sub);
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

  const groupLabel = body ? t(body.label) : category ? t(PART_CATEGORY_LABELS[category]) : null;
  const vehicleCount = base.filter((l) => l.kind !== 'part').length;
  const partCount = base.filter((l) => l.kind === 'part').length;
  const kindLabel =
    kind === 'vehicle'
      ? t('خودرو', 'Vehicles')
      : kind === 'part'
        ? t('قطعات و لوازم یدکی', 'Spare Parts & Accessories')
        : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'AutoDealer',
            '@id': absoluteUrl('/#autodealer'),
            name: 'Ali Sales',
            url: SITE_URL,
            logo: absoluteUrl('/icon.svg'),
            description:
              'Buy and sell new and used cars, motorcycles, heavy machinery and spare parts in Kish, Iran.',
            areaServed: { '@type': 'Place', name: 'Kish Island, Iran' },
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'Kish Island',
              addressRegion: 'Hormozgan',
              addressCountry: 'IR',
            },
            sameAs: [RENTAL_URL],
            makesOffer: [
              {
                '@type': 'Offer',
                itemOffered: { '@type': 'Service', name: 'Vehicle marketplace' },
              },
            ],
          }).replace(/</g, '\\u003c'),
        }}
      />
      <h1 className="sr-only">
        {t('آگهی‌های خودرو در کیش و سراسر ایران', 'Vehicle listings in Kish and across Iran')}
      </h1>
      <div className="mb-3">
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
          <Link href="/" className="text-xs font-bold text-muted underline">
            {t('حذف دسته‌بندی', 'Clear category')}
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
