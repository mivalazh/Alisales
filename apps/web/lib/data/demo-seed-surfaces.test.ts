import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixtureListings } from './fixtures';
import { visibleCatalog } from './demo-seed';
import { adminCenterData } from './admin-center';
import { moderationQueues } from './moderation';
import { loadSellerProfile } from './seller-profile';
import { getOwnerListing } from './listings';
import { storiesFrom } from '../stories';
import { demoListingsHidden } from '../config/mode';
import { devListings } from './dev-store';

/**
 * Launch-switch regression: with the demo seed hidden, every server surface
 * must agree. A user-created row is injected through the demo store so this
 * also proves the switch removes samples without hiding live inventory.
 */
vi.mock('./dev-store', async () => {
  const { fixtureListings: seeds } = await import('./fixtures');
  const userListing = {
    ...seeds[0]!,
    id: 'user-created-listing',
    slug: 'user-created-listing',
    sellerId: 'user-created-seller',
    model: 'User Created',
    trim: null,
    featured: false,
    showroomName: null,
    showroomVerified: false,
    coverUrl: '/covers/photos/land-cruiser-kish-thumb.webp',
  };
  return {
    devListings: () => [userListing],
    applyListingOverrides: (listings: unknown[]) => [...listings],
    updateDevListing: () => true,
    removedListingIds: () => [],
    addDevListing: () => {},
    removeDevListing: () => {},
    listingOverrides: () => ({}),
  };
});

vi.mock('./rate-store', () => ({
  getAedRate: async () => ({
    aedToIrr: 272_000,
    updatedAt: '2026-11-14T00:00:00.000Z',
    source: 'default' as const,
  }),
}));

vi.mock('../storage/demo-store', () => ({
  readJson: (_name: string, empty: () => unknown) => empty(),
  writeJson: () => {},
  readText: () => null,
  writeText: () => {},
  readBytes: () => null,
  writeBytes: () => {},
}));

const ENV_KEYS = [
  'NEXT_PUBLIC_HIDE_DEMO_LISTINGS',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'REQUIRE_HOSTED_SERVICES',
] as const;

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  process.env.NEXT_PUBLIC_HIDE_DEMO_LISTINGS = 'true';
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('demo seed switch across server surfaces', () => {
  it('hides every seeded listing while keeping the user-created row', async () => {
    expect(demoListingsHidden()).toBe(true);

    const seedIds = new Set(fixtureListings.map((listing) => listing.id));
    const seedSlugs = new Set(fixtureListings.map((listing) => listing.slug));
    const sample = fixtureListings.find((listing) => listing.slug === 'land-cruiser-kish')!;
    const user = devListings()[0]!;

    const admin = await adminCenterData();
    expect(admin.listings.map((listing) => listing.id)).toEqual([user.id]);
    expect(admin.listings.some((listing) => seedIds.has(listing.id))).toBe(false);

    const moderation = await moderationQueues();
    expect(moderation.overview.listings).toBe(1);
    expect(moderation.stories.map((story) => story.slug)).toEqual([user.slug]);
    expect(moderation.stories.some((story) => seedSlugs.has(story.slug))).toBe(false);

    expect(await loadSellerProfile(sample.sellerId)).toBeNull();
    const profile = await loadSellerProfile(user.sellerId);
    expect(profile?.listings.map((listing) => listing.id)).toEqual([user.id]);
    expect(profile?.stories.map((story) => story.slug)).toEqual([user.slug]);

    expect(await getOwnerListing(sample.id)).toBeNull();
    expect((await getOwnerListing(user.id))?.slug).toBe(user.slug);

    const rail = storiesFrom(
      visibleCatalog(fixtureListings, devListings()),
      [],
      fixtureListings.map((listing) => listing.slug),
      20,
    );
    expect(rail.map((story) => story.slug)).toEqual([user.slug]);
    expect(rail.some((story) => seedSlugs.has(story.slug))).toBe(false);
  });
});
