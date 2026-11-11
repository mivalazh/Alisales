import type { MetadataRoute } from 'next';
import { DEFAULT_FILTERS } from '@alisales/schemas';
import { searchListings } from '@/lib/data/listings';
import { absoluteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/cars'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/motorcycles'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: absoluteUrl('/heavy'), lastModified: now, changeFrequency: 'weekly', priority: 0.75 },
    { url: absoluteUrl('/parts'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/inspection'), lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: absoluteUrl('/about'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/support'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/guide'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: absoluteUrl('/terms'), lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    const listings = await searchListings(DEFAULT_FILTERS);
    return [
      ...staticRoutes,
      ...listings
        .filter((listing) => listing.state === 'active')
        .map((listing) => ({
          url: absoluteUrl(`/listing/${listing.slug}`),
          lastModified: listing.publishedAt ? new Date(listing.publishedAt) : now,
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        })),
    ];
  } catch {
    return staticRoutes;
  }
}
