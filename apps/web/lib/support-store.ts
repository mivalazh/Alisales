import { readJson, writeJson } from './storage/demo-store';
import { admin } from './data/s2-store';

/**
 * Support ticketing — a real thread per ticket.
 *
 * A ticket is the envelope (`support_requests`): owner, subject, category and
 * status. Its conversation is an append-only list of `support_ticket_messages`,
 * each written by the account (`user`) or the support team (`admin`). Nothing
 * here is derived from a mock: both stores write the same rows, and the
 * read paths return them in chronological order.
 *
 * Fixture mode keeps the same shape in two JSON files. Hosted mode uses
 * `support_requests` + `support_ticket_messages` (migration 0021) through the
 * service role only — clients never read or write another account's ticket.
 */

export type SupportTopic = 'technical' | 'advertising' | 'suggestion' | 'report';
export type SupportStatus = 'open' | 'pending' | 'answered' | 'closed';
export type SupportSenderRole = 'user' | 'admin';

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderRole: SupportSenderRole;
  senderId: string | null;
  body: string;
  attachmentUrl: string | null;
  createdAt: string;
}

export interface SupportRequest {
  id: string;
  /** Owning account; null for guest tickets tracked by code only. */
  userId: string | null;
  /** Legacy admin inbox category. */
  kind: 'brand' | 'ticket';
  topic: SupportTopic;
  /** Short headline shown in the inbox list. */
  subject: string;
  code: string;
  status: SupportStatus;
  /** Legacy single reply; the thread is the source of truth. */
  reply: string | null;
  name: string;
  contact: string;
  model: string;
  message: string;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

const STORE = 'support-requests.json';
const MESSAGES = 'support-ticket-messages.json';
const MAX_ENTRIES = 500;
const MAX_MESSAGES = 2000;

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

const STATUSES: ReadonlySet<SupportStatus> = new Set([
  'open',
  'pending',
  'answered',
  'closed',
]);

interface TicketRow {
  id: string;
  user_id?: string | null;
  kind: 'brand' | 'ticket';
  topic: SupportTopic;
  subject?: string | null;
  code: string;
  status: string;
  reply: string | null;
  name: string;
  contact: string;
  model: string;
  message: string;
  attachment_url?: string | null;
  created_at: string;
  updated_at?: string | null;
}

interface MessageRow {
  id: string;
  ticket_id: string;
  sender_role: SupportSenderRole;
  sender_id: string | null;
  body: string;
  attachment_url?: string | null;
  created_at: string;
}

function normalizeStatus(value: string | undefined): SupportStatus {
  return STATUSES.has(value as SupportStatus) ? (value as SupportStatus) : 'pending';
}

function mapTicket(row: TicketRow): SupportRequest {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    kind: row.kind,
    topic: row.topic,
    subject: row.subject?.trim() || row.message.slice(0, 72) || '',
    code: row.code,
    status: normalizeStatus(row.status),
    reply: row.reply ?? null,
    name: row.name,
    contact: row.contact,
    model: row.model,
    message: row.message,
    attachmentUrl: row.attachment_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function mapMessage(row: MessageRow): SupportMessage {
  return {
    id: String(row.id),
    ticketId: String(row.ticket_id),
    senderRole: row.sender_role,
    senderId: row.sender_id ?? null,
    body: row.body,
    attachmentUrl: row.attachment_url ?? null,
    createdAt: String(row.created_at),
  };
}

/** Fixture-mode tickets, newest activity first. */
function readFixtureTickets(): SupportRequest[] {
  const rows = readJson<TicketRow[]>(STORE, () => []);
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => mapTicket({ ...row, code: row.code ?? row.id.slice(0, 8).toUpperCase() }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_ENTRIES);
}

function writeFixtureTicket(ticket: SupportRequest): void {
  const rows = readFixtureTickets().filter((row) => row.id !== ticket.id);
  writeJson(STORE, [ticket, ...rows].slice(0, MAX_ENTRIES));
}

function readFixtureMessages(): SupportMessage[] {
  const rows = readJson<SupportMessage[]>(MESSAGES, () => []);
  return Array.isArray(rows) ? rows : [];
}

function writeFixtureMessages(messages: SupportMessage[]): void {
  writeJson(MESSAGES, messages.slice(-MAX_MESSAGES));
}

/** Every ticket (admin inbox), newest activity first. */
export async function listSupportRequests(): Promise<SupportRequest[]> {
  const sb = admin();
  if (!sb) return readFixtureTickets();
  try {
    const { data } = await sb
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_ENTRIES);
    return ((data ?? []) as TicketRow[]).map(mapTicket);
  } catch {
    return [];
  }
}

/** One account's tickets. Old rows (no owner) fall back to their contact. */
export async function listUserTickets(
  userId: string,
  contact?: string,
): Promise<SupportRequest[]> {
  const all = await listSupportRequests();
  const phone = contact?.trim();
  return all.filter(
    (ticket) =>
      ticket.userId === userId ||
      (ticket.userId === null && Boolean(phone) && ticket.contact === phone),
  );
}

export async function findSupportByCode(code: string): Promise<SupportRequest | null> {
  const wanted = code.trim().toUpperCase();
  if (!wanted) return null;
  const sb = admin();
  if (!sb) {
    return readFixtureTickets().find((row) => row.code.toUpperCase() === wanted) ?? null;
  }
  const { data } = await sb
    .from('support_requests')
    .select('*')
    .eq('code', wanted)
    .maybeSingle();
  return data ? mapTicket(data as TicketRow) : null;
}

export async function findSupportById(id: string): Promise<SupportRequest | null> {
  if (!id) return null;
  const sb = admin();
  if (!sb) return readFixtureTickets().find((row) => row.id === id) ?? null;
  const { data } = await sb
    .from('support_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data ? mapTicket(data as TicketRow) : null;
}

/** The full chronological thread for one ticket. */
export async function listSupportMessages(ticketId: string): Promise<SupportMessage[]> {
  if (!ticketId) return [];
  const sb = admin();
  if (!sb) {
    return readFixtureMessages()
      .filter((message) => message.ticketId === ticketId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  try {
    const { data, error } = await sb
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true })
      .limit(MAX_MESSAGES);
    // A missing table (migration 0021 not applied) leaves the envelope usable.
    if (error) return [];
    return ((data ?? []) as MessageRow[]).map(mapMessage);
  } catch {
    return [];
  }
}

/**
 * Create a ticket and its opening message.
 *
 * The topic acknowledgement is written as the first `admin` message, so a new
 * ticket already looks like a conversation without pretending it is answered:
 * the status stays `open` until a human replies.
 */
export async function createSupportRequest(input: {
  topic: SupportTopic;
  name: string;
  contact: string;
  model: string;
  message: string;
  subject?: string;
  userId?: string | null;
  attachmentUrl?: string | null;
}): Promise<SupportRequest> {
  const id = crypto.randomUUID();
  const code = `AS-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  const entry: SupportRequest = {
    id,
    userId: input.userId ?? null,
    kind: input.topic === 'suggestion' ? 'brand' : 'ticket',
    topic: input.topic,
    subject: input.subject?.trim().slice(0, 120) || input.message.slice(0, 72),
    code,
    status: 'open',
    reply: null,
    name: input.name,
    contact: input.contact,
    model: input.model,
    message: input.message,
    attachmentUrl: input.attachmentUrl ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const sb = admin();
  if (!sb) {
    writeFixtureTicket(entry);
    writeFixtureMessages([
      ...readFixtureMessages(),
      {
        id: crypto.randomUUID(),
        ticketId: entry.id,
        senderRole: 'user',
        senderId: entry.userId,
        body: entry.message,
        attachmentUrl: entry.attachmentUrl,
        createdAt: now,
      },
      {
        id: crypto.randomUUID(),
        ticketId: entry.id,
        senderRole: 'admin',
        senderId: 'system',
        body: ACK[entry.topic],
        attachmentUrl: null,
        createdAt: now,
      },
    ]);
    return entry;
  }

  const row = {
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
  };
  const extended = {
    ...row,
    user_id: entry.userId,
    subject: entry.subject,
    attachment_url: entry.attachmentUrl,
  };

  let inserted = await sb.from('support_requests').insert(extended).select('*').single();
  // A deployment that has not applied 0021 keeps working on the legacy columns.
  if (inserted.error && !entry.userId) {
    inserted = await sb.from('support_requests').insert(row).select('*').single();
  }
  if (inserted.error || !inserted.data) {
    throw new Error(
      `create support request failed: ${inserted.error?.message ?? 'no row returned'}`,
    );
  }

  const saved = mapTicket(inserted.data as TicketRow);
  await addSupportMessage(saved.id, {
    role: 'user',
    senderId: saved.userId,
    body: saved.message,
    attachmentUrl: saved.attachmentUrl,
    statusAfter: 'open',
  });
  await addSupportMessage(saved.id, {
    role: 'admin',
    senderId: 'system',
    body: ACK[saved.topic],
    statusAfter: 'open',
  });
  return saved;
}

/**
 * Append one message and move the ticket to the matching status:
 * a user reply re-opens the work («در حال بررسی»), a support reply marks the
 * ticket «پاسخ داده شد». The update is the caller's decision via `statusAfter`
 * so an acknowledgement can be added without claiming the ticket was answered.
 */
export async function addSupportMessage(
  ticketId: string,
  input: {
    role: SupportSenderRole;
    senderId: string | null;
    body: string;
    attachmentUrl?: string | null;
    statusAfter?: SupportStatus;
  },
): Promise<SupportMessage> {
  const now = new Date().toISOString();
  const message: SupportMessage = {
    id: crypto.randomUUID(),
    ticketId,
    senderRole: input.role,
    senderId: input.senderId,
    body: input.body.trim().slice(0, 4000),
    attachmentUrl: input.attachmentUrl ?? null,
    createdAt: now,
  };
  const statusAfter =
    input.statusAfter ?? (input.role === 'admin' ? 'answered' : 'pending');

  const sb = admin();
  if (!sb) {
    writeFixtureMessages([...readFixtureMessages(), message]);
    const ticket = readFixtureTickets().find((row) => row.id === ticketId);
    if (ticket) {
      writeFixtureTicket({ ...ticket, status: statusAfter, updatedAt: now });
    }
    return message;
  }

  const { error } = await sb.from('support_ticket_messages').insert({
    id: message.id,
    ticket_id: message.ticketId,
    sender_role: message.senderRole,
    sender_id: message.senderId,
    body: message.body,
    attachment_url: message.attachmentUrl,
    created_at: message.createdAt,
  });
  if (error) throw new Error(`store support message failed: ${error.message}`);

  await sb
    .from('support_requests')
    .update({ status: statusAfter, updated_at: now })
    .eq('id', ticketId);
  return message;
}

/** Close (or otherwise re-status) a ticket from the admin inbox. */
export async function updateSupportStatus(
  ticketId: string,
  status: SupportStatus,
): Promise<boolean> {
  const now = new Date().toISOString();
  const sb = admin();
  if (!sb) {
    const ticket = readFixtureTickets().find((row) => row.id === ticketId);
    if (!ticket) return false;
    writeFixtureTicket({ ...ticket, status, updatedAt: now });
    return true;
  }
  const { error } = await sb
    .from('support_requests')
    .update({ status, updated_at: now })
    .eq('id', ticketId);
  return !error;
}
