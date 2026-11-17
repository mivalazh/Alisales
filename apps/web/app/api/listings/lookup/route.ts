import { NextResponse } from 'next/server';
import { listingById } from '@/lib/data/s2-store';

/**
 * GET /api/listings/lookup?ids=a,b,c
 *
 * Resolves the saved-listings page's stored ids back to their live listings,
 * so a bookmark always shows that listing's current cover photo instead of a
 * stale copy. Unknown or deleted ids are skipped.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const ids = (url.searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .slice(0, 60);

  if (ids.length === 0) return NextResponse.json({ items: [] });

  const rows = await Promise.all(ids.map((id) => listingById(id)));
  const items = rows.flatMap((listing) =>
    listing
      ? [
          {
            id: listing.id,
            slug: listing.slug,
            coverUrl: listing.coverUrl ?? null,
            model: listing.part ? listing.part.title : listing.model,
            year: listing.year,
            priceIRR: listing.priceIRR,
          },
        ]
      : [],
  );

  return NextResponse.json({ items });
}
