import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { addInspection } from '@/lib/data/platform-store';
import { normalizePhone } from '@alisales/schemas';

/**
 * POST /api/inspections — book a Shamsollah workshop inspection.
 *
 * Open to guests on purpose: the offer is a lead magnet at the bottom of a
 * listing, and an account wall there loses most of the bookings. The request
 * lands in the /admin inspection queue; confirming it from there marks the
 * related listing as workshop-inspected.
 */
function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const body = (raw ?? {}) as Record<string, unknown>;
  const name = text(body.name, 80);
  const phone = text(body.phone, 20);
  const date = text(body.date, 20);
  const time = text(body.time, 20);
  const vehicle = text(body.vehicle, 120);
  const listingSlug = text(body.listingSlug, 160) || null;
  const listingTitle = text(body.listingTitle, 160) || null;
  const note = text(body.note, 500) || null;

  if (name.length < 3) {
    return NextResponse.json({ error: 'نام و نام خانوادگی را کامل بنویسید.' }, { status: 400 });
  }
  if (!/^09\d{9}$/.test(normalizePhone(phone))) {
    return NextResponse.json({ error: 'شماره موبایل معتبر وارد کنید.' }, { status: 400 });
  }
  if (!date) {
    return NextResponse.json({ error: 'تاریخ مورد نظر را انتخاب کنید.' }, { status: 400 });
  }
  if (!time) {
    return NextResponse.json({ error: 'ساعت مورد نظر را انتخاب کنید.' }, { status: 400 });
  }
  if (vehicle.length < 3) {
    return NextResponse.json({ error: 'خودرو یا قطعه‌ی مورد بررسی را بنویسید.' }, { status: 400 });
  }

  const session = await getSession();
  const booking = addInspection({
    name,
    phone: normalizePhone(phone),
    date,
    time,
    vehicle,
    listingSlug,
    listingTitle,
    note: note ?? (session ? `کاربر: ${session.displayName ?? session.phone}` : null),
  });

  return NextResponse.json({ ok: true, id: booking.id, status: booking.status }, { status: 201 });
}
