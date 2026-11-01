import { NextResponse } from 'next/server';
import { abuseReportSchema } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { admin, listingById, recordAbuseReport } from '@/lib/data/s2-store';

/**
 * POST /api/reports — «گزارش آگهی» (owner of the report: any signed-in user).
 *
 * The reporter always comes from the session; the body only carries the reason
 * and optional details. One report per (listing, reporter) — a repeat is 409.
 * A guest gets 401 (the UI sends them to login), and reporting your own
 * listing is refused.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای گزارش آگهی وارد حساب خود شوید.' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }
  const parsed = abuseReportSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, issues: parsed.error.issues.map((i) => ({ message: i.message })) },
      { status: 400 },
    );
  }

  const listing = await listingById(parsed.data.listingId);
  if (!listing) {
    return NextResponse.json({ error: 'آگهی پیدا نشد.' }, { status: 404 });
  }
  if (listing.sellerId === session.sub) {
    return NextResponse.json({ error: 'گزارش آگهی خودتان ممکن نیست.' }, { status: 400 });
  }

  const result = await recordAbuseReport({
    listingId: parsed.data.listingId,
    reporterId: session.sub,
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
  });
  if (!result.ok) {
    if (result.duplicate) {
      return NextResponse.json({ error: 'این آگهی را قبلاً گزارش کرده‌اید.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'ثبت گزارش انجام نشد؛ دوباره تلاش کنید.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Fixture mode has no moderation queue UI; the count is still exposed to the
 * reporter's own session so a repeat report is answered honestly. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, hosted: admin() !== null });
}
