import { readJson, writeJson } from './storage/demo-store';
import { admin } from './data/s2-store';

export type SupportTopic = 'technical' | 'advertising' | 'suggestion' | 'report';
export type SupportStatus = 'pending' | 'answered';

export interface SupportRequest {
  id: string;
  /** Legacy admin inbox category. */
  kind: 'brand' | 'ticket';
  topic: SupportTopic;
  code: string;
  status: SupportStatus;
  reply: string | null;
  name: string;
  contact: string;
  model: string;
  message: string;
  createdAt: string;
}

const STORE = 'support-requests.json';
const MAX_ENTRIES = 500;
const COLUMNS =
  'id, kind, topic, code, status, reply, name, contact, model, message, created_at';

const ACK: Record<SupportTopic, string> = {
  technical:
    'سلام! تیکت شما ثبت شد. تیم پشتیبانی Ali Sales در ساعات کاری همین‌جا پاسخ می‌دهد.',
  advertising:
    'سلام! درخواست همکاری و تبلیغات شما ثبت شد. کارشناس بازاریابی برای هماهنگی با شما تماس می‌گیرد.',
  suggestion:
    'سلام! پیشنهاد شما ارزشمند است و در فهرست بازبینی محصول قرار گرفت. ممنون که همراه ما هستید.',
  report:
    'سلام! گزارش شما دریافت شد. تیم بررسی آگهی‌ها به‌زودی آن را بررسی می‌کند.',
};

interface SupportRow {
  id: string;
  kind: 'brand' | 'ticket';
  topic: SupportTopic;
  code: string;
  status: SupportStatus;
  reply: string | null;
  name: string;
  contact: string;
  model: string;
  message: string;
  created_at: string;
}

function mapTicket(row: SupportRow): SupportRequest {
  return {
    id: row.id,
    kind: row.kind,
    topic: row.topic,
    code: row.code,
    status: row.status,
    reply: row.reply,
    name: row.name,
    contact: row.contact,
    model: row.model,
    message: row.message,
    createdAt: row.created_at,
  };
}

export async function listSupportRequests(): Promise<SupportRequest[]> {
  const sb = admin();
  if (!sb) {
    const rows = readJson<SupportRequest[]>(STORE, () => []);
    return (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        ...row,
        topic: row.topic ?? 'technical',
        code: row.code ?? row.id.slice(0, 8).toUpperCase(),
        status: row.status ?? 'pending',
        reply: row.reply ?? null,
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_ENTRIES);
  }
  const { data } = await sb
    .from('support_requests')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(MAX_ENTRIES);
  return ((data ?? []) as SupportRow[]).map(mapTicket);
}

export async function findSupportByCode(code: string): Promise<SupportRequest | null> {
  const wanted = code.trim().toUpperCase();
  if (!wanted) return null;
  const sb = admin();
  if (!sb) {
    return (await listSupportRequests()).find((row) => row.code.toUpperCase() === wanted) ?? null;
  }
  const { data } = await sb
    .from('support_requests')
    .select(COLUMNS)
    .eq('code', wanted)
    .maybeSingle();
  return data ? mapTicket(data as SupportRow) : null;
}

export async function createSupportRequest(input: {
  topic: SupportTopic;
  name: string;
  contact: string;
  model: string;
  message: string;
}): Promise<SupportRequest> {
  const id = crypto.randomUUID();
  const code = `AS-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const entry: SupportRequest = {
    id,
    kind: input.topic === 'suggestion' ? 'brand' : 'ticket',
    topic: input.topic,
    code,
    status: 'answered',
    reply: ACK[input.topic],
    name: input.name,
    contact: input.contact,
    model: input.model,
    message: input.message,
    createdAt: new Date().toISOString(),
  };

  const sb = admin();
  if (!sb) {
    const existing = await listSupportRequests();
    writeJson(STORE, [entry, ...existing].slice(0, MAX_ENTRIES));
    return entry;
  }

  const { data, error } = await sb
    .from('support_requests')
    .insert({
      id: entry.id,
      kind: entry.kind,
      topic: entry.topic,
      code: entry.code,
      status: entry.status,
      reply: entry.reply,
      name: entry.name,
      contact: entry.contact,
      model: entry.model,
      message: entry.message,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`create support request failed: ${error?.message ?? 'no row returned'}`);
  }
  return mapTicket(data as SupportRow);
}
