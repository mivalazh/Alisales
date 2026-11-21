import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { HomeCatalogue, HomeCatalogueFallback } from '@/components/HomeCatalogue';
import { searchPublicListings } from '@/lib/data/listings';
import { approvedStories } from '@/lib/data/moderation';
import { storiesFrom } from '@/lib/stories';
import { absoluteUrl, RENTAL_URL, SITE_URL } from '@/lib/seo';

/**
 * Home is statically generated and revalidated every minute.
 *
 * The rendered pool carries no request data (no search params, no cookies, no
 * per-visitor rows), so the HTML can be cached at the edge and served without a
 * database round-trip. Filters and sort are applied in the browser by
 * `HomeCatalogue`, from the same URL they commit to.
 */
export const revalidate = 60;

/** Approved demo highs for the story rail — one per luxury listing. */
const STORY_SLUGS = [
  'land-cruiser-kish',
  'patrol-platinum-kish',
  's-class-kish',
  'cayenne-kish',
] as const;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { url: absoluteUrl('/') },
};

export default async function HomePage() {
  const [pool, approved] = await Promise.all([
    searchPublicListings(DEFAULT_FILTERS),
    approvedStories(),
  ]);
  const stories = storiesFrom(pool, approved, STORY_SLUGS, 4);

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
      <h1 className="sr-only">آگهی‌های خودرو در کیش و سراسر ایران</h1>
      {/* The fallback is the full default catalogue, so the prerendered HTML
          carries real listings and the CDN always has something to serve. */}
      <Suspense fallback={<HomeCatalogueFallback pool={pool} stories={stories} />}>
        <HomeCatalogue pool={pool} stories={stories} />
      </Suspense>
    </>
  );
}
