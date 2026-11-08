import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { addRental, listRentalPosts } from '@/lib/data/platform-store';

/**
 * Rental portal API.
 *
 * GET  — the seeded fleet plus every agency/user posting, newest first.
 * POST — publish a rental (signed-in only). Rates arrive in Toman and are
 *        stored as IRR, exactly like sale prices, so every formatter agrees.
 */
function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function tomanToIrr(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n * 10 : 0;
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ rentals: listRentalPosts() });
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای ثبت آگهی اجاره وارد شوید.' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const body = (raw ?? {}) as Record<string, unknown>;
  const title = text(body.title, 100);
  const kind =
    body.kind === 'scooter' ? 'scooter' : body.kind === 'yacht' ? 'yacht' : 'car';
  const brand = text(body.brand, 40);
  const model = text(body.model, 60);
  const agency = text(body.agency, 80);
  const depositNote = text(body.depositNote, 300);
  const delivery = Array.isArray(body.delivery)
    ? body.delivery.filter((item): item is string => typeof item === 'string').slice(0, 4)
    : [];
  const year = Number(body.year) || 0;
  const minAge = Number(body.minAge) || 18;
  const dailyIRR = tomanToIrr(body.dailyToman);
  const weeklyIRR = tomanToIrr(body.weeklyToman);
  const monthlyIRR = tomanToIrr(body.monthlyToman);

  if (title.length < 5) {
    return NextResponse.json({ error: 'عنوان آگهی را کامل‌تر بنویسید.' }, { status: 400 });
  }
  if (!agency) {
    return NextResponse.json({ error: 'نام نمایشگاه یا آژانس را بنویسید.' }, { status: 400 });
  }
  if (dailyIRR <= 0) {
    return NextResponse.json({ error: 'نرخ روزانه را وارد کنید.' }, { status: 400 });
  }

  const posting = addRental({
    title,
    kind,
    brand,
    model,
    year,
    imageUrl:
      text(body.imageUrl, 300) ||
      (kind === 'yacht' ? '/covers/yachts/azimut.svg' : '/covers/photos/land-cruiser-kish.webp'),
    agency,
    city: 'kish',
    dailyIRR,
    weeklyIRR: weeklyIRR || dailyIRR * 6,
    monthlyIRR: monthlyIRR || dailyIRR * 26,
    depositNote,
    delivery,
    minAge,
    capacity: Math.min(40, Math.max(1, Number(body.capacity) || (kind === 'yacht' ? 10 : 4))),
    captainIncluded: kind === 'yacht' ? true : body.captainIncluded === true,
    ...(kind === 'yacht' ? { lengthFt: Math.max(10, Number(body.lengthFt) || 40) } : {}),
  });

  return NextResponse.json({ ok: true, slug: posting.slug }, { status: 201 });
}
