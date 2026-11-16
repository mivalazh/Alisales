import { readJson, writeJson } from '../storage/demo-store';
import { admin } from './s2-store';

/**
 * Durable notification history.
 *
 * Sold and price-drop facts are written once, on the server, when the listing
 * actually changes. The notification feed reads this history for each account,
 * so a second device sees the same event and the same unread state without a
 * local price snapshot or a device-local sync marker.
 *
 * Fixture mode keeps the same rows in `notifications.json`; hosted mode uses
 * `listing_events` + `notification_reads` (migration 0012). Both tables are
 * service-role only — clients never write their own events or read markers.
 */

export type ListingEventKind = 'sold' | 'price_drop';

export interface ListingEvent {
  id: string;
  listingId: string;
  kind: ListingEventKind;
  /** Price after a drop; null for sold events. */
  priceIRR: number | null;
  /** Price before a drop; null for sold events. */
  previousPriceIRR: number | null;
  createdAt: string;
}

interface NotificationData {
  events: ListingEvent[];
  reads: Record<string, string>;
}

const FILE = 'notifications.json';
const MAX_EVENTS = 500;
const MAX_FEED_EVENTS = 200;

function read(): NotificationData {
  const raw = readJson<Partial<NotificationData>>(FILE, () => ({}));
  return {
    events: Array.isArray(raw.events) ? raw.events : [],
    reads: raw.reads && typeof raw.reads === 'object' ? raw.reads : {},
  };
}

function write(data: NotificationData): void {
  writeJson(FILE, data);
}

interface EventRow {
  id: string;
  listing_id: string;
  kind: ListingEventKind;
  price_irr: number | string | null;
  previous_price_irr: number | string | null;
  created_at: string;
}

function mapEvent(row: EventRow): ListingEvent {
  return {
    id: String(row.id),
    listingId: String(row.listing_id),
    kind: row.kind,
    priceIRR: row.price_irr === null ? null : Number(row.price_irr),
    previousPriceIRR:
      row.previous_price_irr === null ? null : Number(row.previous_price_irr),
    createdAt: String(row.created_at),
  };
}

/** Append one real listing event. Called only after the listing write succeeds. */
export async function recordListingEvent(input: {
  listingId: string;
  kind: ListingEventKind;
  priceIRR?: number | null;
  previousPriceIRR?: number | null;
  createdAt?: string;
}): Promise<ListingEvent> {
  const event: ListingEvent = {
    id: crypto.randomUUID(),
    listingId: input.listingId,
    kind: input.kind,
    priceIRR: input.priceIRR ?? null,
    previousPriceIRR: input.previousPriceIRR ?? null,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  const sb = admin();
  if (!sb) {
    const data = read();
    data.events = [event, ...data.events].slice(0, MAX_EVENTS);
    write(data);
    return event;
  }

  try {
    const { error } = await sb.from('listing_events').insert({
      id: event.id,
      listing_id: event.listingId,
      kind: event.kind,
      price_irr: event.priceIRR,
      previous_price_irr: event.previousPriceIRR,
      created_at: event.createdAt,
    });
    if (error) console.warn('[alisales] listing event was not stored:', error.message);
  } catch (error) {
    // A missing table/column must never fail the listing write itself.
    console.warn('[alisales] listing event store unavailable:', error);
  }
  return event;
}

/** Newest events for the given listings, newest first. */
export async function listListingEvents(
  listingIds: readonly string[],
): Promise<ListingEvent[]> {
  if (listingIds.length === 0) return [];
  const sb = admin();
  if (!sb) {
    const wanted = new Set(listingIds);
    return read()
      .events.filter((event) => wanted.has(event.listingId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_FEED_EVENTS);
  }
  try {
    const { data, error } = await sb
      .from('listing_events')
      .select('id, listing_id, kind, price_irr, previous_price_irr, created_at')
      .in('listing_id', [...listingIds])
      .order('created_at', { ascending: false })
      .limit(MAX_FEED_EVENTS);
    if (error) {
      console.warn('[alisales] notification history unavailable:', error.message);
      return [];
    }
    return ((data ?? []) as EventRow[]).map(mapEvent);
  } catch (error) {
    console.warn('[alisales] notification history unavailable:', error);
    return [];
  }
}

/** Server-side "mark all as read" timestamp for one account. */
export async function notificationReadAt(userId: string): Promise<string | null> {
  const sb = admin();
  if (!sb) return read().reads[userId] ?? null;
  try {
    const { data } = await sb
      .from('notification_reads')
      .select('read_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (!data) return null;
    const value = String((data as { read_at: string }).read_at);
    return Number.isNaN(Date.parse(value)) ? value : new Date(value).toISOString();
  } catch {
    return null;
  }
}

/** Persist one account's read marker so every device agrees. */
export async function markNotificationsRead(userId: string): Promise<string> {
  const sb = admin();
  if (!sb) {
    const readAt = new Date().toISOString();
    const data = read();
    data.reads[userId] = readAt;
    write(data);
    return readAt;
  }
  try {
    const { data, error } = await sb.rpc('mark_notification_read', { p_user: userId });
    if (!error && data) {
      const value = String(data);
      return Number.isNaN(Date.parse(value)) ? value : new Date(value).toISOString();
    }
    if (error) console.warn('[alisales] notification read rpc unavailable:', error.message);
  } catch (error) {
    console.warn('[alisales] notification read rpc unavailable:', error);
  }
  // Last-resort fallback keeps the bell usable; GET still normalizes the value.
  return new Date().toISOString();
}
