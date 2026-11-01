import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AccountType,
  ListingOwnerStats,
  MessageKind,
  VisitSlot,
} from '@alisales/schemas';
import type { ListingCardData } from './listings';

/**
 * S2 server data layer — accounts, account favorites, chat and owner
 * statistics.
 *
 * Two implementations behind one API:
 *  - Fixture mode (no Supabase credentials): a JSON file under `.dev-data`,
 *    exactly like the existing listing dev store, so the whole flow is
 *    reviewable offline.
 *  - Hosted mode (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set): the same
 *    operations against Supabase. These functions run on the server only;
 *    RLS keeps direct client access read-only for the statistics tables and
 *    own-rows-only for favorites.
 *
 * Server code always scopes by the session user id — never by a value sent
 * from the browser.
 */

export interface Account {
  id: string;
  phone: string;
  displayName: string;
  accountType: AccountType;
  createdAt: string;
}

export interface ConversationRow {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface ChatMessageRow {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  /** Structured visit messages carry their kind and slot (fixture mode). */
  kind: MessageKind;
  visit: VisitSlot | null;
}

interface FavoriteRow {
  listingId: string;
  userId: string;
  createdAt: string;
}

interface ViewRow {
  listingId: string;
  viewerId: string;
  createdAt: string;
}

interface S2Data {
  users: Account[];
  favorites: FavoriteRow[];
  views: ViewRow[];
  reveals: ViewRow[];
  conversations: ConversationRow[];
  messages: ChatMessageRow[];
}

const DATA_DIR = join(process.cwd(), '.dev-data');
const FILE = join(DATA_DIR, 's2.json');

function emptyData(): S2Data {
  return { users: [], favorites: [], views: [], reveals: [], conversations: [], messages: [] };
}

function readData(): S2Data {
  try {
    if (!existsSync(FILE)) return emptyData();
    const parsed: unknown = JSON.parse(readFileSync(FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return emptyData();
    return { ...emptyData(), ...(parsed as Partial<S2Data>) };
  } catch {
    return emptyData();
  }
}

function writeData(data: S2Data): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/** Service-role client for hosted mode, or null in fixture mode. */
export function admin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function newId(): string {
  return crypto.randomUUID();
}

// ── Accounts ────────────────────────────────────────────────────────────────

export async function findUserByPhone(phone: string): Promise<Account | null> {
  const sb = admin();
  if (!sb) return readData().users.find((u) => u.phone === phone) ?? null;
  const { data } = await sb
    .from('users')
    .select('id, phone, display_name, created_at')
    .eq('phone', phone)
    .maybeSingle();
  if (!data) return null;
  return {
    id: String(data.id),
    phone: String(data.phone),
    displayName: String(data.display_name),
    accountType: 'individual',
    createdAt: String(data.created_at),
  };
}

export async function createUser(input: {
  phone: string;
  displayName: string;
  accountType: AccountType;
}): Promise<Account> {
  const sb = admin();
  if (!sb) {
    const data = readData();
    const account: Account = {
      id: newId(),
      phone: input.phone,
      displayName: input.displayName,
      accountType: input.accountType,
      createdAt: new Date().toISOString(),
    };
    data.users.push(account);
    writeData(data);
    return account;
  }

  // Hosted mode: the public.users row references auth.users, so the auth
  // identity is created first (phone already verified by our OTP check).
  const created = await sb.auth.admin.createUser({ phone: input.phone, phone_confirm: true });
  if (created.error || !created.data.user) {
    throw new Error(`create auth user failed: ${created.error?.message ?? 'unknown'}`);
  }
  const id = created.data.user.id;
  const { error } = await sb
    .from('users')
    .insert({ id, phone: input.phone, display_name: input.displayName });
  if (error) throw new Error(`create profile failed: ${error.message}`);
  return {
    id,
    phone: input.phone,
    displayName: input.displayName,
    accountType: input.accountType,
    createdAt: new Date().toISOString(),
  };
}

export async function getUser(id: string): Promise<Account | null> {
  const sb = admin();
  if (!sb) return readData().users.find((u) => u.id === id) ?? null;
  const { data } = await sb
    .from('users')
    .select('id, phone, display_name, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: String(data.id),
    phone: String(data.phone),
    displayName: String(data.display_name),
    accountType: 'individual',
    createdAt: String(data.created_at),
  };
}

// ── Favorites ───────────────────────────────────────────────────────────────

export async function addFavorite(userId: string, listingId: string): Promise<void> {
  const sb = admin();
  if (!sb) {
    const data = readData();
    if (!data.favorites.some((f) => f.userId === userId && f.listingId === listingId)) {
      data.favorites.push({ userId, listingId, createdAt: new Date().toISOString() });
      writeData(data);
    }
    return;
  }
  await sb
    .from('listing_favorites')
    .upsert({ user_id: userId, listing_id: listingId }, { onConflict: 'listing_id,user_id' });
}

export async function removeFavorite(userId: string, listingId: string): Promise<void> {
  const sb = admin();
  if (!sb) {
    const data = readData();
    data.favorites = data.favorites.filter(
      (f) => !(f.userId === userId && f.listingId === listingId),
    );
    writeData(data);
    return;
  }
  await sb
    .from('listing_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('listing_id', listingId);
}

export async function listFavoriteIds(userId: string): Promise<string[]> {
  const sb = admin();
  if (!sb) {
    return readData()
      .favorites.filter((f) => f.userId === userId)
      .map((f) => f.listingId);
  }
  const { data } = await sb.from('listing_favorites').select('listing_id').eq('user_id', userId);
  return ((data ?? []) as Array<{ listing_id: string }>).map((r) => r.listing_id);
}

async function favoritesByListing(listingIds: readonly string[]): Promise<FavoriteRow[]> {
  const sb = admin();
  if (!sb) {
    const wanted = new Set(listingIds);
    return readData().favorites.filter((f) => wanted.has(f.listingId));
  }
  if (listingIds.length === 0) return [];
  const { data } = await sb
    .from('listing_favorites')
    .select('listing_id, user_id')
    .in('listing_id', [...listingIds]);
  return ((data ?? []) as Array<{ listing_id: string; user_id: string }>).map((r) => ({
    listingId: r.listing_id,
    userId: r.user_id,
    createdAt: '',
  }));
}

// ── Events (server-written counters) ────────────────────────────────────────

export async function recordView(listingId: string, viewerId: string): Promise<void> {
  const sb = admin();
  if (!sb) {
    const data = readData();
    if (!data.views.some((v) => v.listingId === listingId && v.viewerId === viewerId)) {
      data.views.push({ listingId, viewerId, createdAt: new Date().toISOString() });
      writeData(data);
    }
    return;
  }
  await sb
    .from('listing_views')
    .upsert({ listing_id: listingId, viewer_id: viewerId }, { onConflict: 'listing_id,viewer_id' });
}

export async function recordPhoneReveal(listingId: string, viewerId: string): Promise<void> {
  const sb = admin();
  if (!sb) {
    const data = readData();
    data.reveals.push({ listingId, viewerId, createdAt: new Date().toISOString() });
    writeData(data);
    return;
  }
  await sb.from('phone_reveal_events').insert({ listing_id: listingId, viewer_id: viewerId });
}

// ── Chat ────────────────────────────────────────────────────────────────────

export async function createOrFindConversation(input: {
  listingId: string;
  buyerId: string;
  sellerId: string;
}): Promise<ConversationRow> {
  const sb = admin();
  if (!sb) {
    const data = readData();
    const found = data.conversations.find(
      (c) => c.listingId === input.listingId && c.buyerId === input.buyerId,
    );
    if (found) return found;
    const conversation: ConversationRow = {
      id: newId(),
      listingId: input.listingId,
      buyerId: input.buyerId,
      sellerId: input.sellerId,
      createdAt: new Date().toISOString(),
      lastMessageAt: null,
    };
    data.conversations.push(conversation);
    writeData(data);
    return conversation;
  }

  const { data: existing } = await sb
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id, created_at, last_message_at')
    .eq('listing_id', input.listingId)
    .eq('buyer_id', input.buyerId)
    .maybeSingle();
  if (existing) return mapConversation(existing);
  const { data, error } = await sb
    .from('conversations')
    .insert({ listing_id: input.listingId, buyer_id: input.buyerId, seller_id: input.sellerId })
    .select('id, listing_id, buyer_id, seller_id, created_at, last_message_at')
    .single();
  if (error || !data) throw new Error(`create conversation failed: ${error?.message ?? 'unknown'}`);
  return mapConversation(data);
}

function mapConversation(row: {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  last_message_at: string | null;
}): ConversationRow {
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
  };
}

export async function conversationsForUser(userId: string): Promise<ConversationRow[]> {
  const sb = admin();
  if (!sb) {
    return readData().conversations.filter(
      (c) => c.buyerId === userId || c.sellerId === userId,
    );
  }
  const { data } = await sb
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id, created_at, last_message_at')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);
  return ((data ?? []) as Array<Parameters<typeof mapConversation>[0]>).map(mapConversation);
}

export async function conversationById(id: string): Promise<ConversationRow | null> {
  const sb = admin();
  if (!sb) return readData().conversations.find((c) => c.id === id) ?? null;
  const { data } = await sb
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id, created_at, last_message_at')
    .eq('id', id)
    .maybeSingle();
  return data ? mapConversation(data) : null;
}

export async function messagesForConversation(id: string): Promise<ChatMessageRow[]> {
  const sb = admin();
  if (!sb) {
    return readData()
      .messages.filter((m) => m.conversationId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((m) => ({ ...m, kind: m.kind ?? 'text', visit: m.visit ?? null }));
  }
  const { data } = await sb
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at, kind, visit_date, visit_time')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });
  return ((data ?? []) as Array<{
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    created_at: string;
    kind: MessageKind | null;
    visit_date: string | null;
    visit_time: string | null;
  }>).map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    body: r.body,
    createdAt: r.created_at,
    kind: r.kind ?? 'text',
    visit: r.visit_date ? { date: r.visit_date, time: r.visit_time } : null,
  }));
}

export async function addMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
  kind?: MessageKind;
  visit?: VisitSlot | null;
}): Promise<ChatMessageRow> {
  const sb = admin();
  if (!sb) {
    const data = readData();
    const message: ChatMessageRow = {
      id: newId(),
      conversationId: input.conversationId,
      senderId: input.senderId,
      body: input.body,
      createdAt: new Date().toISOString(),
      kind: input.kind ?? 'text',
      visit: input.visit ?? null,
    };
    data.messages.push(message);
    const conversation = data.conversations.find((c) => c.id === input.conversationId);
    if (conversation) conversation.lastMessageAt = message.createdAt;
    writeData(data);
    return message;
  }
  const kind = input.kind ?? 'text';
  const visit = input.visit ?? null;
  const { data, error } = await sb
    .from('messages')
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      body: input.body,
      kind,
      visit_date: visit?.date ?? null,
      visit_time: visit?.time ?? null,
    })
    .select('id, conversation_id, sender_id, body, created_at')
    .single();
  if (error || !data) throw new Error(`send message failed: ${error?.message ?? 'unknown'}`);
  await sb
    .from('conversations')
    .update({ last_message_at: data.created_at })
    .eq('id', input.conversationId);
  // 0007 persists the structured slot, so hosted chat keeps kind + visit
  // exactly like fixture mode instead of degrading to plain text.
  return {
    id: data.id,
    conversationId: data.conversation_id,
    senderId: data.sender_id,
    body: data.body,
    createdAt: data.created_at,
    kind,
    visit,
  };
}

// ── Owner listings + statistics ─────────────────────────────────────────────

export async function listingsBySeller(sellerId: string): Promise<ListingCardData[]> {
  const sb = admin();
  if (!sb) {
    const { devListings } = await import('./dev-store');
    return devListings().filter((l) => l.sellerId === sellerId);
  }
  const { data } = await sb.from('listing_cards').select('*').eq('seller_id', sellerId);
  return ((data ?? []) as Array<Record<string, unknown>>).map(mapCardRow);
}

function mapCardRow(r: Record<string, unknown>): ListingCardData {
  return {
    id: String(r.id),
    slug: String(r.slug),
    sellerId: String(r.seller_id),
    priceIRR: Number(r.price_irr ?? 0),
    city: String(r.city ?? 'kish'),
    state: (r.state ?? 'active') as ListingCardData['state'],
    featured: Boolean(r.featured),
    publishedAt: (r.published_at as string | null) ?? null,
    hasReport: Boolean(r.has_report),
    brand: String(r.brand ?? ''),
    model: String(r.model ?? ''),
    trim: (r.trim as string | null) ?? null,
    year: Number(r.year ?? 0),
    mileageKm: Number(r.mileage_km ?? 0),
    gearbox: (r.gearbox ?? 'automatic') as ListingCardData['gearbox'],
    fuel: (r.fuel ?? 'petrol') as ListingCardData['fuel'],
    color: (r.color ?? 'white') as ListingCardData['color'],
    condition: (r.condition ?? 'used') as ListingCardData['condition'],
    plateType: (r.plate_type ?? 'unplated') as ListingCardData['plateType'],
    coverUrl: null,
    showroomName: (r.showroom_name as string | null) ?? null,
    showroomVerified: Boolean(r.showroom_verified),
    allowPhoneReveal: Boolean(r.allow_phone_reveal),
    kind: r.kind === 'part' ? 'part' : 'vehicle',
    part: r.part_title
      ? {
          title: String(r.part_title),
          category: String(r.part_category) as NonNullable<ListingCardData['part']>['category'],
          origin: String(r.part_origin) as NonNullable<ListingCardData['part']>['origin'],
          condition: String(r.part_condition) as NonNullable<ListingCardData['part']>['condition'],
          partNumber: (r.part_number as string | null) ?? null,
          compatibility: (r.part_compatibility as string | null) ?? null,
          warranty: (r.part_warranty as string | null) ?? null,
        }
      : null,
  };
}

/** Single listing by id — resolves the seller for a chat target on the server. */
export async function listingById(id: string): Promise<ListingCardData | null> {
  const sb = admin();
  if (!sb) {
    const [{ devListings }, { fixtureListings }] = await Promise.all([
      import('./dev-store'),
      import('./fixtures'),
    ]);
    return [...devListings(), ...fixtureListings].find((l) => l.id === id) ?? null;
  }
  const { data } = await sb.from('listing_cards').select('*').eq('id', id).maybeSingle();
  return data ? mapCardRow(data as Record<string, unknown>) : null;
}

/** Counts per listing for the owner's own listings; guests can never call it. */
export async function ownerStats(ownerId: string): Promise<ListingOwnerStats[]> {
  const listings = await listingsBySeller(ownerId);
  const ids = listings.map((l) => l.id);
  if (ids.length === 0) return [];

  const sb = admin();
  if (!sb) {
    const data = readData();
    const wanted = new Set(ids);
    const conversations = data.conversations.filter((c) => wanted.has(c.listingId));
    const { summarizeOwnerStats } = await import('@alisales/schemas');
    return summarizeOwnerStats({
      listingIds: ids,
      views: data.views.filter((v) => wanted.has(v.listingId)),
      reveals: data.reveals.filter((r) => wanted.has(r.listingId)),
      conversations,
      favorites: data.favorites.filter((f) => wanted.has(f.listingId)),
    });
  }

  const [views, reveals, conversations, favorites] = await Promise.all([
    sb.from('listing_views').select('listing_id, viewer_id').in('listing_id', ids),
    sb.from('phone_reveal_events').select('listing_id').in('listing_id', ids),
    sb.from('conversations').select('listing_id').in('listing_id', ids),
    favoritesByListing(ids),
  ]);
  const { summarizeOwnerStats } = await import('@alisales/schemas');
  return summarizeOwnerStats({
    listingIds: ids,
    views: ((views.data ?? []) as Array<{ listing_id: string; viewer_id: string }>).map((r) => ({
      listingId: r.listing_id,
      viewerId: r.viewer_id,
    })),
    reveals: ((reveals.data ?? []) as Array<{ listing_id: string }>).map((r) => ({
      listingId: r.listing_id,
    })),
    conversations: ((conversations.data ?? []) as Array<{ listing_id: string }>).map((r) => ({
      listingId: r.listing_id,
    })),
    favorites,
  });
}

/**
 * Active listings of one seller — the two-listing free limit (C6).
 *
 * Hosted mode counts the real `listings` rows (vehicles and parts share the
 * quota); the DB trigger only enforces plan slots for user-context writes, so
 * the server-side count is what covers service-role publishes.
 */
export async function activeListingsCount(sellerId: string): Promise<number> {
  const sb = admin();
  if (sb) {
    const { count } = await sb
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', sellerId)
      .eq('state', 'active');
    return count ?? 0;
  }
  const listings = await listingsBySeller(sellerId);
  return listings.filter((l) => l.state === 'active').length;
}
