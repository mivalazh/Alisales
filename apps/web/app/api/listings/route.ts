import { NextResponse } from 'next/server';
import {
  freeLimitDecision,
  listingPublishSchema,
  partListingPublishSchema,
  type ListingPublish,
  type PartListingPublish,
} from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { activeListingsCount, admin } from '@/lib/data/s2-store';
import { publishFixture, publishHosted } from '@/lib/data/publish-store';
import type { ListingCardData } from '@/lib/data/listings';

/**
 * POST /api/listings — publish a listing (S2).
 *
 * Two shapes share this endpoint, selected by `kind`:
 *  - `vehicle` (default, also the S1 payload): cars → vehicles + listings.
 *  - `part`: parts & accessories (`parts_listings`) → listings(kind='part')
 *    + part_details.
 *
 * - Guests get 401; the page itself is also behind the login guard.
 * - Valid listings publish immediately with `state: 'active'` (C6); the DB
 *   default stays untouched.
 * - The two-active-listing free limit is enforced here against the real rows:
 *   sold, archived (paused) and expired listings do not count, and the third
 *   attempt returns «برای آگهی سوم، پلن انتخاب کن.» (403).
 *
 * Storage: hosted mode writes to Supabase when the credentials are present;
 * otherwise the local dev store keeps the whole flow reviewable offline. A
 * production build without credentials answers 503 rather than pretending the
 * listing was published.
 *
 * Payments: this endpoint never charges anything. Money exists only for
 * subscriptions/bump-up/stories (see 0001 subscription_payments).
 */
function toDevCard(data: ListingPublish, sellerId: string): ListingCardData {
  const stamp = `local-${Date.now().toString(36)}`;
  return {
    id: stamp,
    slug: stamp,
    sellerId,
    priceIRR: data.priceIRR,
    city: data.city,
    state: 'active',
    featured: false,
    publishedAt: new Date().toISOString(),
    hasReport: false,
    brand: data.vehicle.brand,
    model: data.vehicle.model,
    trim: data.vehicle.trim,
    year: data.vehicle.year,
    mileageKm: data.vehicle.mileageKm,
    gearbox: data.vehicle.gearbox,
    fuel: data.vehicle.fuel,
    color: data.vehicle.color,
    condition: data.vehicle.condition,
    plateType: data.vehicle.plateType,
    coverUrl: null,
    showroomName: null,
    showroomVerified: false,
    allowPhoneReveal: data.allowPhoneReveal,
    kind: 'vehicle',
    part: null,
  };
}

function toDevPartCard(data: PartListingPublish, sellerId: string): ListingCardData {
  const stamp = `part-${Date.now().toString(36)}`;
  return {
    id: stamp,
    slug: stamp,
    sellerId,
    priceIRR: data.priceIRR,
    city: data.city,
    state: 'active',
    featured: false,
    publishedAt: new Date().toISOString(),
    hasReport: false,
    // Parts have no brand/model/year; the title is the browse title.
    brand: '',
    model: data.title,
    trim: null,
    year: 0,
    mileageKm: 0,
    gearbox: 'automatic',
    fuel: 'petrol',
    color: 'white',
    condition: data.condition === 'new' ? 'new' : 'used',
    plateType: 'unplated',
    coverUrl: null,
    showroomName: null,
    showroomVerified: false,
    allowPhoneReveal: data.allowPhoneReveal,
    kind: 'part',
    part: {
      title: data.title,
      category: data.category,
      origin: data.origin,
      condition: data.condition,
      partNumber: data.partNumber,
      compatibility: data.compatibility,
      warranty: data.warranty,
    },
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'برای ثبت آگهی ابتدا وارد حساب خود شوید.' },
      { status: 401 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const isPart = (raw as { kind?: unknown })?.kind === 'part';

  let payload: ListingPublish | PartListingPublish;
  let fixtureCard: ListingCardData;
  if (isPart) {
    const parsed = partListingPublishSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    payload = parsed.data;
    fixtureCard = toDevPartCard(parsed.data, session.sub);
  } else {
    const parsed = listingPublishSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    payload = parsed.data;
    fixtureCard = toDevCard(parsed.data, session.sub);
  }

  // Two free active listings (C6), counted against the live rows — vehicles
  // and parts share the same quota.
  const decision = freeLimitDecision(await activeListingsCount(session.sub));
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.message }, { status: 403 });
  }

  if (admin()) {
    try {
      const slug = await publishHosted({
        kind: isPart ? 'part' : 'vehicle',
        data: payload,
        sellerId: session.sub,
      });
      return NextResponse.json({ ok: true, slug }, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: 'ثبت آگهی در پایگاه‌داده انجام نشد؛ دوباره تلاش کنید.' },
        { status: 500 },
      );
    }
  }

  // Hosted reads without write credentials would publish into a store nobody
  // reads, so that combination refuses instead of silently vanishing.
  const hostedReads = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  if (hostedReads || process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'ثبت آگهی روی پایگاه‌داده میزبان پیکربندی نشده است.' },
      { status: 503 },
    );
  }

  const slug = publishFixture(fixtureCard);
  return NextResponse.json({ ok: true, slug }, { status: 201 });
}
