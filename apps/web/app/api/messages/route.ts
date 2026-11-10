import { NextResponse } from 'next/server';
import { messagePostSchema, visitMessageBody, type VisitSlot } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { addMessage, conversationById, messagesForConversation } from '@/lib/data/s2-store';
import { markRead, readAt, typingUsers } from '@/lib/data/chat-presence';
import { rateLimit } from '@/lib/security/rate-limit';

const MAX_BODY = 2000;

/**
 * GET /api/messages?conversationId=…&after=<ISO>
 *
 * Polling endpoint for the open thread: new messages since `after`, whether the
 * other participant is typing, and when they last read the thread (the read
 * ticks). Participants only — the id is checked against the session.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای دیدن گفتگو وارد حساب خود شوید.' }, { status: 401 });
  }

  const limited = rateLimit({
    request,
    bucket: 'messages-read',
    key: session.sub,
    limit: 120,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'درخواست‌های گفتگو بیش از حد مجاز است.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get('conversationId') ?? '';
  const after = url.searchParams.get('after') ?? '';
  if (!conversationId) {
    return NextResponse.json({ error: 'شناسه گفتگو لازم است.' }, { status: 400 });
  }

  const conversation = await conversationById(conversationId);
  if (!conversation) {
    return NextResponse.json({ error: 'گفتگو یافت نشد.' }, { status: 404 });
  }
  if (session.sub !== conversation.buyerId && session.sub !== conversation.sellerId) {
    return NextResponse.json({ error: 'به این گفتگو دسترسی ندارید.' }, { status: 403 });
  }

  const otherId =
    session.sub === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
  const all = await messagesForConversation(conversationId);
  const messages = after ? all.filter((m) => m.createdAt > after) : all;

  // Opening or polling the thread is also the read receipt for this viewer.
  markRead(conversationId, session.sub);

  return NextResponse.json({
    ok: true,
    messages,
    typing: typingUsers(conversationId, session.sub).length > 0,
    otherReadAt: readAt(conversationId, otherId),
    serverTime: new Date().toISOString(),
  });
}

/**
 * POST /api/messages
 *
 * `{ conversationId, body }` for a plain message, or
 * `{ conversationId, kind: 'visit_request' | 'visit_accept' | 'visit_counter',
 *    visit?: { date, time } }` for the structured visit flow
 * (`visit_request_chat`).
 *
 * Only the two participants may post, the sender id always comes from the
 * session, and the role rules are enforced here: the buyer asks for a visit,
 * only the seller accepts or proposes another time.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای ارسال پیام وارد حساب خود شوید.' }, { status: 401 });
  }

  const limited = rateLimit({
    request,
    bucket: 'messages-write',
    key: session.sub,
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: 'ارسال پیام بیش از حد مجاز است؛ چند لحظه صبر کنید.' },
      { status: 429, headers: { 'Retry-After': String(limited.retryAfterSeconds) } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }
  const parsed = messagePostSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'درخواست پیام نامعتبر است.' },
      { status: 400 },
    );
  }
  const payload = parsed.data;
  const conversationId = payload.conversationId;
  const kind = payload.kind;
  const visit: VisitSlot | null = payload.visit ?? null;

  const conversation = await conversationById(conversationId);
  if (!conversation) {
    return NextResponse.json({ error: 'گفتگو یافت نشد.' }, { status: 404 });
  }
  if (session.sub !== conversation.buyerId && session.sub !== conversation.sellerId) {
    return NextResponse.json({ error: 'به این گفتگو دسترسی ندارید.' }, { status: 403 });
  }

  let text: string;
  if (kind === 'visit_request') {
    if (session.sub !== conversation.buyerId) {
      return NextResponse.json(
        { error: 'درخواست بازدید را فقط خریدار می‌فرستد.' },
        { status: 403 },
      );
    }
    text = visitMessageBody('visit_request', visit);
  } else if (kind === 'visit_accept' || kind === 'visit_counter') {
    if (session.sub !== conversation.sellerId) {
      return NextResponse.json(
        { error: 'پاسخ به درخواست بازدید فقط از سوی فروشنده ممکن است.' },
        { status: 403 },
      );
    }
    if (!visit) {
      return NextResponse.json({ error: 'زمان بازدید را انتخاب کنید.' }, { status: 400 });
    }
    text = visitMessageBody(kind, visit);
  } else {
    text = typeof payload.body === 'string' ? payload.body.trim() : '';
    if (text.length === 0 || text.length > MAX_BODY) {
      return NextResponse.json(
        { error: `متن پیام باید بین ۱ و ${MAX_BODY} نویسه باشد.` },
        { status: 400 },
      );
    }
  }

  const message = await addMessage({
    conversationId,
    senderId: session.sub,
    body: text,
    kind,
    visit,
  });
  return NextResponse.json({ ok: true, message });
}
