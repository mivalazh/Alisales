import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminSession } from '@/lib/admin/guard';
import {
  createSupportRequest,
  findSupportByCode,
  findSupportById,
  listSupportMessages,
  listUserTickets,
  type SupportRequest,
  type SupportTopic,
} from '@/lib/support-store';

const TOPICS: SupportTopic[] = ['technical', 'advertising', 'suggestion', 'report'];

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Inbox row: envelope + the newest message, so the list never needs the thread. */
async function inboxRow(ticket: SupportRequest) {
  const messages = await listSupportMessages(ticket.id);
  const last = messages[messages.length - 1] ?? null;
  return {
    id: ticket.id,
    code: ticket.code,
    subject: ticket.subject,
    topic: ticket.topic,
    status: ticket.status,
    preview: (last?.body ?? ticket.message).slice(0, 140),
    messageCount: messages.length,
    createdAt: ticket.createdAt,
    updatedAt: last?.createdAt ?? ticket.updatedAt,
  };
}

/**
 * GET /api/support
 *
 *   (no query)    → this account's tickets, newest activity first
 *   ?ticketId=…   → that ticket's full thread (owner or support team only)
 *   ?code=AS-…    → legacy single-ticket lookup by tracking code
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const ticketId = url.searchParams.get('ticketId')?.trim();
  const code = url.searchParams.get('code')?.trim();
  const session = await getSession();

  if (ticketId) {
    const ticket = await findSupportById(ticketId);
    if (!ticket) return NextResponse.json({ error: 'تیکت پیدا نشد.' }, { status: 404 });
    const staff = await adminSession();
    const owner = Boolean(session && ticket.userId === session.sub);
    if (!owner && !staff) {
      return NextResponse.json({ error: 'این تیکت متعلق به حساب شما نیست.' }, { status: 403 });
    }
    return NextResponse.json({
      ticket: {
        id: ticket.id,
        code: ticket.code,
        subject: ticket.subject,
        topic: ticket.topic,
        status: ticket.status,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
      messages: await listSupportMessages(ticket.id),
    });
  }

  if (code) {
    const ticket = await findSupportByCode(code);
    if (!ticket) return NextResponse.json({ error: 'تیکتی با این کد پیدا نشد.' }, { status: 404 });
    // The tracking code is the guest's credential — the same model 0010 used.
    return NextResponse.json({
      ticket: {
        id: ticket.id,
        code: ticket.code,
        topic: ticket.topic,
        subject: ticket.subject,
        status: ticket.status,
        reply: ticket.reply,
        message: ticket.message,
        createdAt: ticket.createdAt,
      },
      messages: await listSupportMessages(ticket.id),
    });
  }

  if (!session) {
    return NextResponse.json({ authed: false, tickets: [] });
  }
  const tickets = await listUserTickets(session.sub, session.phone);
  return NextResponse.json({
    authed: true,
    tickets: await Promise.all(tickets.slice(0, 40).map(inboxRow)),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const body = (raw ?? {}) as Record<string, unknown>;
  const topic = TOPICS.includes(body.topic as SupportTopic)
    ? (body.topic as SupportTopic)
    : body.kind === 'brand'
      ? 'suggestion'
      : 'technical';
  const message = text(body.message, 4000);
  const subject = text(body.subject, 120);
  const attachmentUrl = text(body.attachmentUrl, 500) || null;
  const session = await getSession();
  // A signed-in seller never retypes their own name and phone number.
  const name = text(body.name, 80) || session?.displayName || '';
  const contact = text(body.contact, 80) || session?.phone || '';
  const model = text(body.model, 80);

  if (name.length < 2) {
    return NextResponse.json({ error: 'نام خود را وارد کنید.' }, { status: 400 });
  }
  if (contact.length < 5) {
    return NextResponse.json({ error: 'شماره موبایل یا ایمیل معتبر وارد کنید.' }, { status: 400 });
  }
  if (message.length < 5) {
    return NextResponse.json({ error: 'متن درخواست را کامل‌تر بنویسید.' }, { status: 400 });
  }
  if (subject && subject.length < 3) {
    return NextResponse.json({ error: 'موضوع تیکت را کامل‌تر بنویسید.' }, { status: 400 });
  }

  const entry = await createSupportRequest({
    topic,
    name,
    contact,
    model,
    message,
    subject,
    userId: session?.sub ?? null,
    attachmentUrl,
  });
  return NextResponse.json(
    {
      ok: true,
      id: entry.id,
      code: entry.code,
      status: entry.status,
      reply: entry.reply,
      topic: entry.topic,
      subject: entry.subject,
    },
    { status: 201 },
  );
}
