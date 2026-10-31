import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  conversationsForUser,
  createOrFindConversation,
  listingById,
} from '@/lib/data/s2-store';

/** GET  /api/conversations — the signed-in account's conversations. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'وارد حساب خود نشده‌اید.' }, { status: 401 });
  }
  return NextResponse.json({ conversations: await conversationsForUser(session.sub) });
}

/**
 * POST /api/conversations — { listingId }
 *
 * One conversation per (listing, buyer). The seller is resolved from the
 * listing on the server; a client-supplied seller id is never trusted.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'برای شروع گفتگو وارد حساب خود شوید.' },
      { status: 401 },
    );
  }

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
  if (!listing) {
    return NextResponse.json({ error: 'آگهی یافت نشد.' }, { status: 404 });
  }
  if (listing.sellerId === session.sub) {
    return NextResponse.json({ error: 'نمی‌توانید با آگهی خودتان گفتگو کنید.' }, { status: 400 });
  }
  if (listing.state === 'sold') {
    return NextResponse.json({ error: 'این آگهی فروخته شده است.' }, { status: 409 });
  }

  const conversation = await createOrFindConversation({
    listingId,
    buyerId: session.sub,
    sellerId: listing.sellerId,
  });
  return NextResponse.json({ ok: true, id: conversation.id });
}
