import { NextResponse } from 'next/server';
import { tomanRateToIrr } from '@alisales/schemas';
import { adminSession } from '@/lib/admin/guard';
import { getAedRate, setAedRate } from '@/lib/data/rate-store';

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

  let body: { toman?: unknown };
  try {
    body = (await request.json()) as { toman?: unknown };
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const toman =
    typeof body.toman === 'string' ? Number(body.toman) : (body.toman as number | undefined);
  if (typeof toman !== 'number' || !Number.isFinite(toman)) {
    return NextResponse.json({ error: 'نرخ را به تومان وارد کنید.' }, { status: 400 });
  }

  const rial = tomanRateToIrr(toman);
  if (rial < 10_000 || rial > 10_000_000) {
    return NextResponse.json(
      { error: 'نرخ باید بین ۱٬۰۰۰ و ۱٬۰۰۰٬۰۰۰ تومان برای هر درهم باشد.' },
      { status: 400 },
    );
  }

  const rate = await setAedRate(toman, 'admin');
  return NextResponse.json({ ok: true, rate });
}
