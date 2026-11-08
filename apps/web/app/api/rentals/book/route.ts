import { NextResponse } from 'next/server';
import { addRentalBooking } from '@/lib/data/platform-store';
import { allRentals } from '@/lib/rentals';

/**
 * POST /api/rentals/book — an online reservation request from the /rent
 * calculator. The price is recalculated server-side from the stored daily rate
 * so the browser cannot submit an arbitrary total. The agency confirms by
 * phone; the row stays `pending` until then.
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
  const rentalSlug = text(body.rentalSlug, 120);
  const rentalTitle = text(body.rentalTitle, 160);
  const name = text(body.name, 80);
  const phone = text(body.phone, 24);
  const from = text(body.from, 10);
  const to = text(body.to, 10);
  const days = Math.min(60, Math.max(1, Number(body.days) || 1));
  const plan = body.plan === 'full' ? 'full' : 'basic';

  if (!rentalSlug || !rentalTitle) {
    return NextResponse.json({ error: 'اطلاعات آگهی اجاره ناقص است.' }, { status: 400 });
  }
  if (!name || phone.replace(/\D/g, '').length < 10) {
    return NextResponse.json({ error: 'نام و شماره تماس معتبر وارد کنید.' }, { status: 400 });
  }

  // Trust the stored daily rate, never the browser-submitted total: the client
  // only computes what it shows, the row keeps the server's number.
  const rental = allRentals().find((item) => item.slug === rentalSlug);
  if (!rental) {
    return NextResponse.json({ error: 'آگهی اجاره پیدا نشد.' }, { status: 404 });
  }
  const base = rental.dailyIRR * days;
  const totalIRR = plan === 'full' ? Math.round(base * 1.12) : base;

  const booking = addRentalBooking({
    rentalSlug,
    rentalTitle: rental.title,
    name,
    phone,
    from,
    to,
    days,
    plan,
    totalIRR,
  });

  return NextResponse.json({ ok: true, id: booking.id }, { status: 201 });
}
