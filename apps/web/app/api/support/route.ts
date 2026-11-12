import { NextResponse } from 'next/server';
import {
  createSupportRequest,
  findSupportByCode,
  type SupportTopic,
} from '@/lib/support-store';

const TOPICS: SupportTopic[] = ['technical', 'advertising', 'suggestion', 'report'];

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function GET(request: Request): Promise<NextResponse> {
  const code = new URL(request.url).searchParams.get('code')?.trim();
  if (!code) return NextResponse.json({ error: 'کد پیگیری را وارد کنید.' }, { status: 400 });
  const ticket = findSupportByCode(code);
  if (!ticket) return NextResponse.json({ error: 'تیکتی با این کد پیدا نشد.' }, { status: 404 });
  return NextResponse.json({
    ticket: {
      code: ticket.code,
      topic: ticket.topic,
      status: ticket.status,
      reply: ticket.reply,
      message: ticket.message,
      createdAt: ticket.createdAt,
    },
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
  const name = text(body.name, 80);
  const contact = text(body.contact, 80);
  const model = text(body.model, 80);
  const message = text(body.message, 1200);

  if (name.length < 2) {
    return NextResponse.json({ error: 'نام خود را وارد کنید.' }, { status: 400 });
  }
  if (contact.length < 5) {
    return NextResponse.json({ error: 'شماره موبایل یا ایمیل معتبر وارد کنید.' }, { status: 400 });
  }
  if (message.length < 5) {
    return NextResponse.json({ error: 'متن درخواست را کامل‌تر بنویسید.' }, { status: 400 });
  }

  const entry = createSupportRequest({ topic, name, contact, model, message });
  return NextResponse.json(
    {
      ok: true,
      id: entry.id,
      code: entry.code,
      status: entry.status,
      reply: entry.reply,
      topic: entry.topic,
    },
    { status: 201 },
  );
}
