import { devListings } from './dev-store';
import { fixtureListings } from './fixtures';
import { visibleCatalog } from './demo-seed';
import { moderationQueues, type ModerationQueues } from './moderation';
import {
  adminSettings,
  listInspections,
  listStories,
  type AdminSettings,
  type InspectionBooking,
  type StorySubmission,
} from './platform-store';
import { getAedRate } from './rate-store';
import { listSupportMessages, listSupportRequests } from '../support-store';
import type { AedRate, ListingState } from '@alisales/schemas';

/**
 * Owner control centre data (`/admin`).
 *
 * One server read assembles everything the five tabs need: the live catalogue,
 * story submissions, inspection bookings, AED rate + source, support tickets
 * and suggestions, and the existing moderation queues. All mutations still go
 * through `/api/admin`, which re-checks the owner on every request.
 */

export interface AdminListingRow {
  id: string;
  slug: string;
  title: string;
  kind: 'vehicle' | 'part';
  city: string;
  state: ListingState;
  priceIRR: number;
  featured: boolean;
  publishedAt: string | null;
  coverUrl: string | null;
}

export interface AdminSupportItem {
  id: string;
  kind: 'brand' | 'ticket';
  code: string;
  subject: string;
  topic: string;
  status: import('../support-store').SupportStatus;
  userId: string | null;
  name: string;
  contact: string;
  model: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  /** The exact thread the user sees — support answers from it. */
  messages: Array<{
    id: string;
    senderRole: 'user' | 'admin';
    senderId: string | null;
    body: string;
    attachmentUrl: string | null;
    createdAt: string;
  }>;
}

export interface AdminCenterData {
  queues: ModerationQueues;
  listings: AdminListingRow[];
  storySubmissions: StorySubmission[];
  inspections: InspectionBooking[];
  tickets: AdminSupportItem[];
  rate: AedRate;
  settings: AdminSettings;
}

export async function adminCenterData(): Promise<AdminCenterData> {
  const [queues, rate, storySubmissions, inspections, supportRequests, settings] =
    await Promise.all([
      moderationQueues(),
      getAedRate(),
      listStories(),
      listInspections(),
      listSupportRequests(),
      adminSettings(),
    ]);
  const listings: AdminListingRow[] = visibleCatalog(fixtureListings, devListings())
    .map((listing) => ({
      id: listing.id,
      slug: listing.slug,
      title: listing.part ? listing.part.title : `${listing.model} ${listing.year}`,
      kind: listing.part ? ('part' as const) : ('vehicle' as const),
      city: listing.city,
      state: listing.state,
      priceIRR: listing.priceIRR,
      featured: listing.featured,
      publishedAt: listing.publishedAt,
      coverUrl: listing.coverUrl,
    }))
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));

  const tickets: AdminSupportItem[] = await Promise.all(
    supportRequests.slice(0, 30).map(async (ticket) => ({
      id: ticket.id,
      kind: ticket.kind,
      code: ticket.code,
      subject: ticket.subject,
      topic: ticket.topic,
      status: ticket.status,
      userId: ticket.userId,
      name: ticket.name,
      contact: ticket.contact,
      model: ticket.model,
      message: ticket.message,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      messages: (await listSupportMessages(ticket.id)).map((message) => ({
        id: message.id,
        senderRole: message.senderRole,
        senderId: message.senderId,
        body: message.body,
        attachmentUrl: message.attachmentUrl,
        createdAt: message.createdAt,
      })),
    })),
  );

  return {
    queues,
    listings,
    storySubmissions,
    inspections,
    tickets,
    rate,
    settings,
  };
}
