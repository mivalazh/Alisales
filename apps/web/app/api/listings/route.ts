import { NextResponse } from 'next/server';
import { listingPublishSchema, type ListingPublish } from '@alisales/schemas';
import { addDevListing } from '@/lib/data/dev-store';
import type { ListingCardData } from '@/lib/data/listings';

/**
 * POST /api/listings — validates against the shared @alisales/schemas
 * publish schema (all messages فارسی via the installed error map).
 *
 * Storage/auth wiring:
 * - No Supabase credentials → local dev store (dev only; production 503).
 * - Credentials present → RLS requires an authenticated session; auth lands
 *   in Phase 4, so the honest answer today is 401.
 */
function toDevCard(data: ListingPublish): ListingCardData {
  const stamp = `local-${Date.now().toString(36)}`;
  return {
    id: stamp,
    slug: stamp,
    sellerId: 'local-dev',
    priceIRR: data.priceIRR,
    city: data.city,
    state: 'pending_review',
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
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'بدنه درخواست نامعتبر است.' },
      { status: 400 },
    );
  }

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

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!configured) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { ok: false, error: 'ذخیره‌سازی سرور پیکربندی نشده است؛ لطفاً بعداً تلاش کنید.' },
        { status: 503 },
      );
    }
    const card = toDevCard(parsed.data);
    addDevListing(card);
    return NextResponse.json({ ok: true, slug: card.slug }, { status: 201 });
  }

  return NextResponse.json(
    { ok: false, error: 'برای ثبت آگهی ابتدا وارد حساب خود شوید.' },
    { status: 401 },
  );
}
