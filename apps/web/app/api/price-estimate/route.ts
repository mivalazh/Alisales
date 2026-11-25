import { NextResponse } from 'next/server';
import { vehicleCategories, type VehicleCategory } from '@alisales/schemas';
import { estimateListingPrice } from '@/lib/pricing/estimate';

/**
 * GET /api/price-estimate?brand=&model=&year=&plateType=&category=
 *
 * «قیمت پیشنهادی بازار» for the listing form. The range is computed from the
 * public catalogue's own comparables (see `lib/pricing/estimate.ts`), so the
 * route stays a thin, cached read: public data only, no session, no writes.
 */
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const CACHE = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } as const;

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const rawCategory = url.searchParams.get('category') ?? 'car';
  const category = (vehicleCategories as readonly string[]).includes(rawCategory)
    ? (rawCategory as VehicleCategory)
    : 'car';
  const year = Number.parseInt(url.searchParams.get('year') ?? '', 10);

  try {
    const estimate = await estimateListingPrice({
      brand: url.searchParams.get('brand'),
      model: url.searchParams.get('model'),
      year: Number.isFinite(year) ? year : null,
      plateType: url.searchParams.get('plateType'),
      category,
    });
    return NextResponse.json({ ok: true, ...estimate }, { headers: CACHE });
  } catch (error) {
    // A pricing helper must never break the form: answer an empty estimate and
    // keep the reason in the server log.
    console.warn('[alisales/price-estimate] failed:', error);
    return NextResponse.json(
      { ok: false, source: 'none', count: 0, minIRR: null, avgIRR: null, maxIRR: null },
      { status: 503, headers: NO_STORE },
    );
  }
}
