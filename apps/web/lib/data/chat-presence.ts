import { readJson, writeJson } from '../storage/demo-store';

/**
 * Chat presence: typing state and read receipts.
 *
 * Both are ephemeral by nature, so they live beside the demo store rather than
 * in a new database table (the brief keeps the Supabase schema untouched):
 *  - Node / `next dev` / `next start`: one JSON file, so two browsers on the
 *    same server really do see each other's typing and read ticks;
 *  - Workers: isolate memory, i.e. best effort — the same caveat the demo
 *    listings and chat already carry.
 *
 * If the durable path ever moves to Supabase, these two maps become a
 * `conversation_presence` row and a `read_at` column; the API shape stays.
 */

const FILE = 'chat-presence.json';
/** A typing flag that was not refreshed expires — no stuck «در حال نوشتن». */
const TYPING_TTL_MS = 6_000;

interface PresenceData {
  typing: Record<string, number>;
  reads: Record<string, string>;
}

function read(): PresenceData {
  const data = readJson<PresenceData>(FILE, () => ({ typing: {}, reads: {} }));
  return {
    typing: data.typing ?? {},
    reads: data.reads ?? {},
  };
}

function key(conversationId: string, userId: string): string {
  return `${conversationId}::${userId}`;
}

/** Mark (or clear) «X is typing» for this conversation. */
export function setTyping(conversationId: string, userId: string, typing: boolean): void {
  const data = read();
  const id = key(conversationId, userId);
  if (typing) data.typing[id] = Date.now();
  else delete data.typing[id];
  writeJson(FILE, data);
}

/** User ids (other than `viewerId`) currently typing, TTL-filtered. */
export function typingUsers(conversationId: string, viewerId: string): string[] {
  const data = read();
  const now = Date.now();
  return Object.entries(data.typing)
    .filter(([id, at]) => id.startsWith(`${conversationId}::`) && now - at < TYPING_TTL_MS)
    .map(([id]) => id.split('::')[1]!)
    .filter((id) => id && id !== viewerId);
}

/** The viewer opened the thread: everything up to now is read. */
export function markRead(conversationId: string, userId: string): string {
  const data = read();
  const at = new Date().toISOString();
  data.reads[key(conversationId, userId)] = at;
  writeJson(FILE, data);
  return at;
}

/** When the other participant last read this thread (ISO), or null. */
export function readAt(conversationId: string, userId: string): string | null {
  return read().reads[key(conversationId, userId)] ?? null;
}
