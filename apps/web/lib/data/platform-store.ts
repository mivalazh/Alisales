import { readJson, writeJson } from '../storage/demo-store';

/**
 * Platform demo store — the launch features that do not exist in the hosted
 * schema yet: user story submissions, workshop inspection bookings, the
 * story paywall flag and the AI assistant's topic counters.
 *
 * Everything runs through the same demo storage as the rest of the preview
 * (JSON on Node, isolate memory on Workers), so a reviewer can exercise the
 * whole flow on a deployed preview without a database.
 */

export interface StorySubmission {
  id: string;
  title: string;
  /** Image/video URL — a listing cover or a data URL from the uploader. */
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

// ── Settings ────────────────────────────────────────────────────────────────

export function adminSettings(): AdminSettings {
  return read().settings;
}

export function setStoryPaidGuard(enabled: boolean): AdminSettings {
  const data = read();
  data.settings = { ...data.settings, storyPaidGuard: enabled };
  write(data);
  return data.settings;
}

// ── Stories ─────────────────────────────────────────────────────────────────

export function listStories(status?: StorySubmission['status']): StorySubmission[] {
  const all = read().stories;
  return (status ? all.filter((s) => s.status === status) : all).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function addStory(input: Omit<StorySubmission, 'id' | 'createdAt' | 'status'>): StorySubmission {
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

export function decideStorySubmission(
  id: string,
  decision: StorySubmission['status'],
): void {
  const data = read();
  data.stories = data.stories.map((s) => (s.id === id ? { ...s, status: decision } : s));
  write(data);
}

export function deleteStorySubmission(id: string): void {
  const data = read();
  data.stories = data.stories.filter((s) => s.id !== id);
  write(data);
}

// ── Inspection bookings ─────────────────────────────────────────────────────

export function listInspections(): InspectionBooking[] {
  return [...read().inspections].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addInspection(
  input: Omit<InspectionBooking, 'id' | 'createdAt' | 'status'>,
): InspectionBooking {
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

export function updateInspection(
  id: string,
  status: InspectionBooking['status'],
): InspectionBooking | null {
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

// ── Assistant FAQ counters ──────────────────────────────────────────────────

export function trackFaq(topic: string): void {
  const data = read();
  data.faqs = { ...data.faqs, [topic]: (data.faqs[topic] ?? 0) + 1 };
  write(data);
}

/** Most-asked analysed topics, seeded so the chip bar is useful on day one. */
export function topFaqTopics(limit = 5): string[] {
  const counts = read().faqs;
  const seeded: Record<string, number> = {
    'خودروی ارزان کیش': 18,
    'فرق پلاک منطقه آزاد و گذر موقت': 15,
    'چک‌لیست کارشناسی پیش از خرید': 12,
    'قطعات استوک اصل': 9,
    'اجاره خودرو در کیش': 7,
  };
  return Object.entries({ ...seeded, ...counts })
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic]) => topic);
}
