import {
  ABUSE_REASON_LABELS,
  DEFAULT_CITY,
  featureFlags,
  formatJalaliDate,
  maskPhone,
  type AbuseReason,
} from '@alisales/schemas';
import { admin, listingById, openAbuseReports, setReportStatus, allUsers } from './s2-store';
import { fixtureListings } from './fixtures';
import { devListings, updateDevListing } from './dev-store';
import { visibleCatalog } from './demo-seed';
import {
  readModerationState,
  moderationOverlay,
  setReportDecision,
  setStoryDecision,
  setVerificationDecision,
  hideListing,
} from './moderation-store';
import {
  applyModeration,
  overviewCounts,
  type ReportDecision,
  type VerificationDecision,
} from './moderation-rules';
import type { ListingCardData } from './listings';

/**
 * Owner moderation hub (`/admin`).
 *
 * Three queues, all backed by data the platform already has:
 *
 *  - **Reports** — `abuse_reports` rows from «گزارش آگهی». Dismiss keeps the
 *    listing live; act-on pauses it immediately.
 *  - **Verifications** — accounts that signed up as نمایشگاه/تعمیرگاه wait for
 *    approval. Approving marks the seller verified, which is what puts the
 *    «نمایشگاه معتبر» pill on their cards. On a brand-new demo deployment there
 *    are no such accounts yet, so one clearly-labelled sample row is shown to
 *    keep the queue reviewable; it disappears once decided.
 *  - **Stories** — active listings with a photo, ready for the home story rail.
 *    Approving pins the listing to the front of the rail.
 *
 * Every mutation is authorized in the route handler (`adminSession()`), never
 * here, and never trusts an id from the browser beyond the action it names.
 */

export interface ReportItem {
  id: string;
  listingId: string;
  listingSlug: string | null;
  listingTitle: string;
  reason: string;
  details: string | null;
  /** Jalali date, formatted on the server so SSR and the client agree. */
  dateLabel: string;
}

export interface VerificationItem {
  id: string;
  displayName: string;
  phoneMasked: string;
  createdAt: string;
  dateLabel: string;
  /** Demo-only placeholder so a fresh preview still has something to review. */
  sample: boolean;
}

export interface StoryQueueItem {
  slug: string;
  title: string;
  coverUrl: string;
  city: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface PlatformOverview {
  activeVehicles: number;
  activeParts: number;
  sold: number;
  users: number;
  listings: number;
  city: { slug: string; label: string; selectionEnabled: boolean; note: string };
  hosted: boolean;
}

export interface ModerationQueues {
  reports: ReportItem[];
  verifications: VerificationItem[];
  stories: StoryQueueItem[];
  overview: PlatformOverview;
}

function listingTitle(listing: ListingCardData): string {
  if (listing.part) return listing.part.title;
  return `${listing.model}${listing.trim ? ` ${listing.trim}` : ''} ${listing.year}`;
}

function reasonLabel(reason: string): string {
  const key = reason as AbuseReason;
  return ABUSE_REASON_LABELS[key] ?? reason;
}

/** Jalali date for a stored ISO timestamp; falls back to an empty label. */
function dateLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : formatJalaliDate(date);
}

/** Full public catalog (fixtures + owner-created) with moderation applied. */
async function catalog(): Promise<ListingCardData[]> {
  const overlay = moderationOverlay();
  return applyModeration(visibleCatalog(fixtureListings, devListings()), {
    hidden: overlay.hidden,
    verifiedSellers: overlay.verifiedSellers,
  });
}

export async function moderationQueues(): Promise<ModerationQueues> {
  const state = readModerationState();
  const listings = await catalog();

  // ── Reports ──────────────────────────────────────────────────────────────
  const stored = await openAbuseReports();
  const reports: ReportItem[] = [];
  for (const report of stored) {
    const decision = state.reports[report.id];
    if (decision && decision !== 'open') continue;
    const listing = listings.find((entry) => entry.id === report.listingId) ?? null;
    reports.push({
      id: report.id,
      listingId: report.listingId,
      listingSlug: listing?.slug ?? null,
      listingTitle: listing ? listingTitle(listing) : 'آگهی حذف‌شده',
      reason: reasonLabel(report.reason),
      details: report.details,
      dateLabel: dateLabel(report.createdAt),
    });
  }

  // ── Verifications ────────────────────────────────────────────────────────
  const users = await allUsers();
  const verifications: VerificationItem[] = [];
  for (const user of users) {
    if (user.accountType !== 'showroom') continue;
    const decision = state.verifications[user.id];
    if (decision === 'approved' || decision === 'rejected') continue;
    verifications.push({
      id: user.id,
      displayName: user.displayName,
      phoneMasked: maskPhone(user.phone),
      createdAt: user.createdAt,
      dateLabel: dateLabel(user.createdAt),
      sample: false,
    });
  }
  const hasRealQueue = verifications.length > 0;
  const sampleDecision = state.verifications['sample-showroom'];
  if (!hasRealQueue && !sampleDecision && !admin()) {
    verifications.push({
      id: 'sample-showroom',
      displayName: 'نمایشگاه نمونه کیش',
      phoneMasked: maskPhone('09120000000'),
      createdAt: new Date().toISOString(),
      dateLabel: dateLabel(new Date().toISOString()),
      sample: true,
    });
  }

  // ── Stories ──────────────────────────────────────────────────────────────
  const stories: StoryQueueItem[] = listings
    .filter((listing) => Boolean(listing.coverUrl))
    .filter((listing) => listing.state === 'active' || listing.state === 'sold')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
    .slice(0, 24)
    .map((listing) => ({
      slug: listing.slug,
      title: listingTitle(listing),
      coverUrl: listing.coverUrl as string,
      city: listing.city,
      status: state.stories[listing.slug] ?? 'pending',
    }));

  const counts = overviewCounts(listings);
  const hosted = admin() !== null;

  return {
    reports,
    verifications,
    stories,
    overview: {
      ...counts,
      users: users.length,
      listings: listings.length,
      city: {
        slug: DEFAULT_CITY,
        label: 'کیش',
        selectionEnabled: featureFlags.city_selection,
        note: featureFlags.city_selection
          ? 'انتخاب شهر فعال است؛ همه شهرها قابل نمایش‌اند.'
          : 'انتخاب شهر خاموش است؛ نمایش و جست‌وجو فقط برای کیش فعال است.',
      },
      hosted,
    },
  };
}

/** Home-page story rail order: owner-approved stories first. */
export async function approvedStories(): Promise<string[]> {
  const state = readModerationState();
  return Object.entries(state.stories)
    .filter(([, decision]) => decision === 'approved')
    .map(([slug]) => slug);
}

export interface ModerationActionResult {
  ok: boolean;
  error?: string;
}

export async function decideReport(
  id: string,
  decision: Exclude<ReportDecision, 'open'>,
): Promise<ModerationActionResult> {
  if (!id) return { ok: false, error: 'شناسه‌ی گزارش نامعتبر است.' };
  setReportDecision(id, decision);
  await setReportStatus(id, decision);
  return { ok: true };
}

/** Actioning a report pauses the listing it points at. */
export async function actionReport(id: string, listingId: string): Promise<ModerationActionResult> {
  const result = await decideReport(id, 'actioned');
  if (!result.ok) return result;
  const listing = await listingById(listingId);
  if (listing && listing.state === 'active') {
    updateDevListing(listingId, { state: 'paused' });
    const sb = admin();
    if (sb) await sb.from('listings').update({ state: 'paused' }).eq('id', listingId);
  }
  return { ok: true };
}

export async function decideVerification(
  id: string,
  decision: Exclude<VerificationDecision, 'pending'>,
): Promise<ModerationActionResult> {
  if (!id) return { ok: false, error: 'شناسه‌ی درخواست نامعتبر است.' };
  setVerificationDecision(id, decision);

  const sb = admin();
  if (sb && id !== 'sample-showroom') {
    // Hosted verification is the showroom license: keep the row in sync so the
    // public catalog and the hub agree after a reload.
    await sb
      .from('showrooms')
      .update({ license_status: decision === 'approved' ? 'approved' : 'rejected' })
      .eq('owner_id', id);
  }
  return { ok: true };
}

export async function decideStory(
  slug: string,
  decision: 'approved' | 'rejected',
): Promise<ModerationActionResult> {
  if (!slug) return { ok: false, error: 'شناسه‌ی آگهی نامعتبر است.' };
  setStoryDecision(slug, decision);
  return { ok: true };
}

export async function removeListing(id: string): Promise<ModerationActionResult> {
  if (!id) return { ok: false, error: 'شناسه‌ی آگهی نامعتبر است.' };
  hideListing(id);
  updateDevListing(id, { state: 'rejected' });
  const sb = admin();
  if (sb) await sb.from('listings').update({ state: 'rejected' }).eq('id', id);
  return { ok: true };
}

export async function featureListing(
  id: string,
  featured: boolean,
): Promise<ModerationActionResult> {
  if (!id) return { ok: false, error: 'شناسه‌ی آگهی نامعتبر است.' };
  updateDevListing(id, { featured });
  const sb = admin();
  if (sb) await sb.from('listings').update({ featured }).eq('id', id);
  return { ok: true };
}

/** Bump: publish date = now, so the row returns to the top of «جدیدترین». */
export async function bumpListing(id: string): Promise<ModerationActionResult> {
  if (!id) return { ok: false, error: 'شناسه‌ی آگهی نامعتبر است.' };
  const publishedAt = new Date().toISOString();
  updateDevListing(id, { publishedAt });
  const sb = admin();
  if (sb) await sb.from('listings').update({ published_at: publishedAt }).eq('id', id);
  return { ok: true };
}

/** Confirm an inspection and mark its listing as workshop-inspected. */
export async function markInspected(slug: string | null): Promise<void> {
  if (!slug) return;
  const found = visibleCatalog(fixtureListings, devListings()).find((listing) => listing.slug === slug);
  if (found) updateDevListing(found.id, { hasReport: true });
}

export async function pauseListing(id: string): Promise<ModerationActionResult> {
  if (!id) return { ok: false, error: 'شناسه‌ی آگهی نامعتبر است.' };
  updateDevListing(id, { state: 'paused' });
  const sb = admin();
  if (sb) await sb.from('listings').update({ state: 'paused' }).eq('id', id);
  return { ok: true };
}
