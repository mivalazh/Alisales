import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { admin, accountPhone, listingById, recordPhoneReveal } from '@/lib/data/s2-store';
import { FIXTURE_SELLER_PHONE, getSellerPhone } from '@/lib/data/listings';

/**
 * POST /api/phone-reveal — { listingId }
 *
 * Called when a signed-in visitor taps the call button or the «نمایش شماره»
 * CTA. Every tap is an append-only `phone_reveal_events` row («نمایش شماره»),
 * kept strictly separate from «گفتگوی جدید». A guest tap records nothing and
 * gets 401; the owner's own tap and sold listings record nothing.
 *
 * The response carries the number so the CTA can become a real call link after
 * the reveal — the phone is never exposed before this authenticated call.
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

  const hosted = admin() !== null;
  const phone =
    (await getSellerPhone(listingId)) ??
    (hosted ? null : ((await accountPhone(listing.sellerId)) ?? FIXTURE_SELLER_PHONE));

  return NextResponse.json({ ok: true, phone });
}
