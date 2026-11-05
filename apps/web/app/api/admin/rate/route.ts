import { NextResponse } from 'next/server';
import { tomanRateToIrr } from '@alisales/schemas';
import { adminSession } from '@/lib/admin/guard';
import { getAedRate, refreshAedRate, setAedRate } from '@/lib/data/rate-store';

/** GET — the current stored rate (admin only). */
export async function GET(): Promise<NextResponse> {
  if (!(await adminSession())) {
    return NextResponse.json({ error: 'دسترسی ندارید.' }, { status: 403 });
  }
  return NextResponse.json({ ok: true, rate: await getAedRate() });
}

/**
 * POST /api/admin/rate
 *
 * `{ toman: 27200 }` saves the owner's rate (stored as rial). The number is
 * validated against a plausible window before it can reach every AED figure on
 * the site.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await adminSession())) {
    return NextResponse.json({ error: 'دسترسی ندارید.' }, { status: 403 });
  }

  let body: { toman?: unknown; refresh?: unknown };
  try {
    body = (await request.json()) as { toman?: unknown; refresh?: unknown };
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  // «دریافت نرخ لحظه‌ای» — pulls the live market value and stores it as auto.
  if (body.refresh === true) {
    try {
      return NextResponse.json({ ok: true, rate: await refreshAedRate() });
    } catch {
      return NextResponse.json(
        { error: 'نرخ لحظه‌ای در دسترس نیست؛ از نرخ ذخیره‌شده استفاده می‌شود.' },
        { status: 502 },
      );
    }
  }

  const toman =
    typeof body.toman === 'string' ? Number(body.toman) : (body.toman as number | undefined);
  if (typeof toman !== 'number' || !Number.isFinite(toman)) {
    return NextResponse.json({ error: 'نرخ را به تومان وارد کنید.' }, { status: 400 });
  }

  const rial = tomanRateToIrr(toman);
  // Same 15,000–60,000 Toman window as the automatic feed: a manual override
  // cannot push an impossible number either.
  if (rial < 150_000 || rial > 600_000) {
    return NextResponse.json(
      { error: 'نرخ باید بین ۱۵٬۰۰۰ و ۶۰٬۰۰۰ تومان برای هر درهم باشد.' },
      { status: 400 },
    );
  }

  const rate = await setAedRate(toman, 'admin');
  return NextResponse.json({ ok: true, rate });
}
