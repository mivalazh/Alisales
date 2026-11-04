import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { conversationById } from '@/lib/data/s2-store';
import { setTyping } from '@/lib/data/chat-presence';

/**
 * POST /api/messages/typing — `{ conversationId, typing: boolean }`
 *
 * The flag is short-lived (6s) and only ever read for the other participant, so
 * a dropped connection can never leave «در حال نوشتن…» on screen.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'وارد حساب خود شوید.' }, { status: 401 });

  let body: { conversationId?: unknown; typing?: unknown };
  try {
    body = (await request.json()) as { conversationId?: unknown; typing?: unknown };
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
  if (!conversationId) {
    return NextResponse.json({ error: 'شناسه گفتگو لازم است.' }, { status: 400 });
  }

  const conversation = await conversationById(conversationId);
  if (!conversation) return NextResponse.json({ error: 'گفتگو یافت نشد.' }, { status: 404 });
  if (session.sub !== conversation.buyerId && session.sub !== conversation.sellerId) {
    return NextResponse.json({ error: 'به این گفتگو دسترسی ندارید.' }, { status: 403 });
  }

  setTyping(conversationId, session.sub, body.typing !== false);
  return NextResponse.json({ ok: true });
}
