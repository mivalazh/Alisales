import { readJson, writeJson } from './storage/demo-store';

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

export function listSupportRequests(): SupportRequest[] {
  const rows = readJson<SupportRequest[]>(STORE, () => []);
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    topic: row.topic ?? 'technical',
    code: row.code ?? row.id.slice(0, 8).toUpperCase(),
    status: row.status ?? 'pending',
    reply: row.reply ?? null,
  }));
}

export function findSupportByCode(code: string): SupportRequest | null {
  const wanted = code.trim().toUpperCase();
  return listSupportRequests().find((row) => row.code.toUpperCase() === wanted) ?? null;
}

export function createSupportRequest(input: {
  topic: SupportTopic;
  name: string;
  contact: string;
  model: string;
  message: string;
}): SupportRequest {
  const existing = listSupportRequests();
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
  writeJson(STORE, [...existing, entry].slice(-MAX_ENTRIES));
  return entry;
}
