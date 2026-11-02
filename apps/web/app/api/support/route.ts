import { NextResponse } from 'next/server';
import { readJson, writeJson } from '@/lib/storage/demo-store';

/**
 * Support inbox — brand requests and tickets. The demo deployment keeps them
 * in the demo store (JSON file on Node, isolate memory on Workers); hosted
 * environments will swap in the Supabase table without changing this contract.
 */
interface SupportRequest {
  id: string;
  kind: 'brand' | 'ticket';
  name: string;
  contact: string;
  model: string;
  message: string;
  createdAt: string;
}

const STORE = 'support-requests.json';
const MAX_ENTRIES = 500;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const body = (raw ?? {}) as Record<string, unknown>;
  const kind = body.kind === 'brand' ? 'brand' : body.kind === 'ticket' ? 'ticket' : null;
  const name = text(body.name, 80);
  const contact = text(body.contact, 80);
  const model = text(body.model, 80);
  const message = text(body.message, 1200);

  if (!kind) {
    return NextResponse.json({ error: 'نوع درخواست نامعتبر است.' }, { status: 400 });
  }
  if (name.length < 2) {
    return NextResponse.json({ error: 'نام خود را وارد کنید.' }, { status: 400 });
  }
  if (contact.length < 5) {
    return NextResponse.json({ error: 'شماره موبایل یا ایمیل معتبر وارد کنید.' }, { status: 400 });
  }
  if (message.length < 5) {
    return NextResponse.json({ error: 'متن درخواست را کامل‌تر بنویسید.' }, { status: 400 });
  }

  const entry: SupportRequest = {
    id: crypto.randomUUID(),
    kind,
    name,
    contact,
    model,
    message,
    createdAt: new Date().toISOString(),
  };

  const existing = readJson<SupportRequest[]>(STORE, () => []);
  const list = Array.isArray(existing) ? existing : [];
  writeJson(STORE, [...list, entry].slice(-MAX_ENTRIES));

  return NextResponse.json({ ok: true, id: entry.id }, { status: 201 });
}
