import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { listingById, recordPhoneReveal } from '@/lib/data/s2-store';

/**
 * POST /api/phone-reveal — { listingId }
 *
 * Called when a signed-in visitor taps the call button. «نمایش شماره» is a
 * separate counter from «گفتگوی جدید» (C2); a guest tap records nothing.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }
  const listingId = typeof (raw as { listingId?: unknown })?.listingId === 'string'
    ? (raw as { listingId: string }).listingId
    : '';
  if (!listingId) {
    return NextResponse.json({ error: 'شناسه آگهی لازم است.' }, { status: 400 });
  }

  const listing = await listingById(listingId);
  if (!listing || listing.sellerId === session.sub || listing.state !== 'active') {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  if (!listing.allowPhoneReveal) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  await recordPhoneReveal(listingId, session.sub);
  return NextResponse.json({ ok: true });
}
