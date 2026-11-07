import { readJson } from '../storage/demo-store';
import { devListings } from './dev-store';
import { fixtureListings } from './fixtures';
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
import type { AedRate } from '@alisales/schemas';

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
  state: string;
  priceIRR: number;
  featured: boolean;
  publishedAt: string | null;
  coverUrl: string | null;
}

export interface AdminSupportItem {
  id: string;
  kind: 'brand' | 'ticket';
  name: string;
  contact: string;
  model: string;
  message: string;
  createdAt: string;
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
  const [queues, rate] = await Promise.all([moderationQueues(), getAedRate()]);
  const listings: AdminListingRow[] = [...devListings(), ...fixtureListings]
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

  const tickets = readJson<AdminSupportItem[]>('support-requests.json', () => []);
  const sortedTickets = Array.isArray(tickets)
    ? [...tickets].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  return {
    queues,
    listings,
    storySubmissions: listStories(),
    inspections: listInspections(),
    tickets: sortedTickets,
    rate,
    settings: adminSettings(),
  };
}
