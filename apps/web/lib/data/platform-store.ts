import { readJson, writeJson } from '../storage/demo-store';
import { admin } from './s2-store';
import { deleteMediaUrl } from './media-store';

/**
 * Platform flows: user story submissions, workshop inspection bookings, the
 * story paywall setting and the AI assistant's topic counters.
 *
 * Fixture mode keeps the old demo-store behavior so the whole flow remains
 * reviewable offline. Hosted mode uses Supabase tables, so stories, bookings,
 * tickets and counters survive redeploys and are shared across Worker isolates.
 * These functions are async in both modes.
 */

export interface StorySubmission {
  id: string;
  title: string;
  /** Public URL in the `story-media` bucket. */
  mediaUrl: string;
  mediaKind: 'image' | 'video';
  authorId: string;
  authorName: string;
  /** Optional listing the story points at. */
  listingSlug: string | null;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface InspectionBooking {
  id: string;
  name: string;
  phone: string;
  /** ISO date (YYYY-MM-DD) and a time label («۱۰:۳۰»). */
  date: string;
  time: string;
  vehicle: string;
  listingSlug: string | null;
  listingTitle: string | null;
  note: string | null;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'done' | 'cancelled';
}

export interface AdminSettings {
  /** false = free launch stories; true = subscription/paywall guard. */
  storyPaidGuard: boolean;
}

interface PlatformData {
  stories: StorySubmission[];
  inspections: InspectionBooking[];
  settings: AdminSettings;
  faqs: Record<string, number>;
}

const FILE = 'platform.json';
const STORY_COLUMNS =
  'id, title, media_url, media_kind, author_id, author_name, listing_slug, created_at, status';
const INSPECTION_COLUMNS =
  'id, name, phone, date, time, vehicle, listing_slug, listing_title, note, created_at, status';

const DEFAULTS: PlatformData = {
  stories: [],
  inspections: [],
  settings: { storyPaidGuard: false },
  faqs: {},
};

function read(): PlatformData {
  const raw = readJson<Partial<PlatformData>>(FILE, () => ({}));
  return {
    ...DEFAULTS,
    ...raw,
    settings: { ...DEFAULTS.settings, ...(raw.settings ?? {}) },
    faqs: { ...(raw.faqs ?? {}) },
  };
}

function write(data: PlatformData): void {
  writeJson(FILE, data);
}

interface StoryRow {
  id: string;
  title: string;
  media_url: string;
  media_kind: 'image' | 'video';
  author_id: string;
  author_name: string;
  listing_slug: string | null;
  created_at: string;
  status: StorySubmission['status'];
}

function mapStory(row: StoryRow): StorySubmission {
  return {
    id: row.id,
    title: row.title,
    mediaUrl: row.media_url,
    mediaKind: row.media_kind,
    authorId: row.author_id,
    authorName: row.author_name,
    listingSlug: row.listing_slug,
    createdAt: row.created_at,
    status: row.status,
  };
}

interface InspectionRow {
  id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  vehicle: string;
  listing_slug: string | null;
  listing_title: string | null;
  note: string | null;
  created_at: string;
  status: InspectionBooking['status'];
}

function mapInspection(row: InspectionRow): InspectionBooking {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    date: row.date,
    time: row.time,
    vehicle: row.vehicle,
    listingSlug: row.listing_slug,
    listingTitle: row.listing_title,
    note: row.note,
    createdAt: row.created_at,
    status: row.status,
  };
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function adminSettings(): Promise<AdminSettings> {
  const sb = admin();
  if (!sb) return read().settings;
  const { data } = await sb
    .from('platform_settings')
    .select('story_paid_guard')
    .eq('singleton', true)
    .maybeSingle();
  return { storyPaidGuard: Boolean(data?.story_paid_guard) };
}

export async function setStoryPaidGuard(enabled: boolean): Promise<AdminSettings> {
  const sb = admin();
  if (!sb) {
    const data = read();
    data.settings = { ...data.settings, storyPaidGuard: enabled };
    write(data);
    return data.settings;
  }
  const { data, error } = await sb
    .from('platform_settings')
    .upsert(
      { singleton: true, story_paid_guard: enabled },
      { onConflict: 'singleton' },
    )
    .select('story_paid_guard')
    .single();
  if (error || !data) {
    throw new Error(`save platform settings failed: ${error?.message ?? 'no row returned'}`);
  }
  return { storyPaidGuard: Boolean(data.story_paid_guard) };
}

// ── Stories ─────────────────────────────────────────────────────────────────

export async function listStories(
  status?: StorySubmission['status'],
): Promise<StorySubmission[]> {
  const sb = admin();
  if (!sb) {
    const all = read().stories;
    return (status ? all.filter((s) => s.status === status) : all)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 200);
  }
  let query = sb
    .from('story_submissions')
    .select(STORY_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return ((data ?? []) as StoryRow[]).map(mapStory);
}

export async function addStory(
  input: Omit<StorySubmission, 'id' | 'createdAt' | 'status'>,
): Promise<StorySubmission> {
  const sb = admin();
  if (!sb) {
    const data = read();
    const story: StorySubmission = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      // The paid guard, when enabled, holds stories for approval; free launch
      // stories go live immediately.
      status: data.settings.storyPaidGuard ? 'pending' : 'approved',
    };
    data.stories = [...data.stories, story].slice(-200);
    write(data);
    return story;
  }

  const settings = await adminSettings();
  const { data, error } = await sb
    .from('story_submissions')
    .insert({
      title: input.title,
      media_url: input.mediaUrl,
      media_kind: input.mediaKind,
      author_id: input.authorId,
      author_name: input.authorName,
      listing_slug: input.listingSlug,
      status: settings.storyPaidGuard ? 'pending' : 'approved',
    })
    .select(STORY_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`create story failed: ${error?.message ?? 'no row returned'}`);
  }
  return mapStory(data as StoryRow);
}

export async function decideStorySubmission(
  id: string,
  decision: StorySubmission['status'],
): Promise<void> {
  const sb = admin();
  if (!sb) {
    const data = read();
    data.stories = data.stories.map((s) => (s.id === id ? { ...s, status: decision } : s));
    write(data);
    return;
  }
  const { error } = await sb.from('story_submissions').update({ status: decision }).eq('id', id);
  if (error) throw new Error(`update story failed: ${error.message}`);
}

export async function deleteStorySubmission(id: string): Promise<void> {
  const sb = admin();
  if (!sb) {
    const data = read();
    const mediaUrl = data.stories.find((s) => s.id === id)?.mediaUrl;
    data.stories = data.stories.filter((s) => s.id !== id);
    write(data);
    await deleteMediaUrl(mediaUrl);
    return;
  }
  const { data: story } = await sb
    .from('story_submissions')
    .select('media_url')
    .eq('id', id)
    .maybeSingle();
  const { error } = await sb.from('story_submissions').delete().eq('id', id);
  if (error) throw new Error(`delete story failed: ${error.message}`);
  await deleteMediaUrl((story as { media_url?: string } | null)?.media_url);
}

// ── Inspection bookings ─────────────────────────────────────────────────────

export async function listInspections(): Promise<InspectionBooking[]> {
  const sb = admin();
  if (!sb) {
    return [...read().inspections]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 500);
  }
  const { data } = await sb
    .from('inspection_bookings')
    .select(INSPECTION_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500);
  return ((data ?? []) as InspectionRow[]).map(mapInspection);
}

export async function addInspection(
  input: Omit<InspectionBooking, 'id' | 'createdAt' | 'status'>,
): Promise<InspectionBooking> {
  const sb = admin();
  if (!sb) {
    const data = read();
    const booking: InspectionBooking = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    data.inspections = [...data.inspections, booking].slice(-500);
    write(data);
    return booking;
  }
  const { data, error } = await sb
    .from('inspection_bookings')
    .insert({
      name: input.name,
      phone: input.phone,
      date: input.date,
      time: input.time,
      vehicle: input.vehicle,
      listing_slug: input.listingSlug,
      listing_title: input.listingTitle,
      note: input.note,
      status: 'pending',
    })
    .select(INSPECTION_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`create inspection failed: ${error?.message ?? 'no row returned'}`);
  }
  return mapInspection(data as InspectionRow);
}

export async function updateInspection(
  id: string,
  status: InspectionBooking['status'],
): Promise<InspectionBooking | null> {
  const sb = admin();
  if (!sb) {
    const data = read();
    let found: InspectionBooking | null = null;
    data.inspections = data.inspections.map((booking) => {
      if (booking.id !== id) return booking;
      found = { ...booking, status };
      return found;
    });
    write(data);
    return found;
  }
  const { data } = await sb
    .from('inspection_bookings')
    .update({ status })
    .eq('id', id)
    .select(INSPECTION_COLUMNS)
    .maybeSingle();
  return data ? mapInspection(data as InspectionRow) : null;
}

// ── Assistant FAQ counters ──────────────────────────────────────────────────

const SEEDED_FAQ: Record<string, number> = {
  'خودروی ارزان کیش': 18,
  'فرق پلاک منطقه آزاد و گذر موقت': 15,
  'چک‌لیست کارشناسی پیش از خرید': 12,
  'قطعات استوک اصل': 9,
  'اجاره خودرو در کیش': 7,
};

export async function trackFaq(topic: string): Promise<void> {
  const sb = admin();
  if (!sb) {
    const data = read();
    data.faqs = { ...data.faqs, [topic]: (data.faqs[topic] ?? 0) + 1 };
    write(data);
    return;
  }
  const { error } = await sb.rpc('increment_faq_topic', { topic_name: topic });
  if (error) throw new Error(`track faq failed: ${error.message}`);
}

/** Most-asked analysed topics, seeded so the chip bar is useful on day one. */
export async function topFaqTopics(limit = 5): Promise<string[]> {
  const sb = admin();
  const counts: Record<string, number> = !sb
    ? read().faqs
    : (((await sb.from('ai_faq_counts').select('topic, count')).data ??
        []) as Array<{ topic: string; count: number }>).reduce<Record<string, number>>(
        (acc, row) => {
          acc[row.topic] = Number(row.count);
          return acc;
        },
        {},
      );
  return Object.entries({ ...SEEDED_FAQ, ...counts })
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic]) => topic);
}
