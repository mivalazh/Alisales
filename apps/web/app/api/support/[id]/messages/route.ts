import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminSession } from '@/lib/admin/guard';
import {
  addSupportMessage,
  findSupportById,
  listSupportMessages,
} from '@/lib/support-store';

/**
 * POST /api/support/:id/messages — one reply from the ticket owner.
 *
 * Ownership is checked on the server from the signed session; the browser only
 * sends the text. A reply moves the ticket back to «در حال بررسی», so the
 * support team sees it again in the inbox.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای ادامه گفتگو وارد حساب شوید.' }, { status: 401 });
  }

  const ticket = await findSupportById(id);
  if (!ticket) return NextResponse.json({ error: 'تیکت پیدا نشد.' }, { status: 404 });
  const staff = await adminSession();
  if (ticket.userId !== session.sub && !staff) {
    return NextResponse.json({ error: 'این تیکت متعلق به حساب شما نیست.' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }
  const body = typeof (raw as { body?: unknown })?.body === 'string'
    ? ((raw as { body: string }).body ?? '').trim().slice(0, 4000)
    : '';
  if (body.length < 1) {
    return NextResponse.json({ error: 'متن پیام را بنویسید.' }, { status: 400 });
  }

  const message = await addSupportMessage(ticket.id, {
    role: staff && ticket.userId !== session.sub ? 'admin' : 'user',
    senderId: session.sub,
    body,
    statusAfter: staff && ticket.userId !== session.sub ? 'answered' : 'pending',
  });

  return NextResponse.json({
    ok: true,
    message,
    status: staff && ticket.userId !== session.sub ? 'answered' : 'pending',
    messages: await listSupportMessages(ticket.id),
  });
}
