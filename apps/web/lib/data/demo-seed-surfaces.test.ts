import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fixtureListings } from './fixtures';
import { visibleCatalog } from './demo-seed';
import { adminCenterData } from './admin-center';
import { moderationQueues } from './moderation';
import { loadSellerProfile } from './seller-profile';
import { devListings } from './dev-store';
import { storiesFrom } from '../stories';

/**
 * Launch-switch regression: with the demo seed hidden, the seller, admin,
 * moderation and story surfaces must all drop the fixtures while keeping a
 * user-created row. The row lives in an isolated real demo data directory, so
 * the fixture/live composition runs without mocking the data layer.
 */
const userListing = {
  ...fixtureListings[0]!,
  id: 'user-created-listing',
  slug: 'user-created-listing',
  sellerId: 'user-created-seller',
};

let dataDir: string;

beforeAll(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'alisales-demo-seed-'));
  writeFileSync(join(dataDir, 'listings.json'), JSON.stringify([userListing]));
  // A stored manual rate keeps the admin read offline and deterministic.
  writeFileSync(
    join(dataDir, 'settings.json'),
    JSON.stringify({ rate: { aedToIrr: 272_000, source: 'admin' } }),
  );

  vi.stubEnv('DEMO_DATA_DIR', dataDir);
  vi.stubEnv('NEXT_PUBLIC_HIDE_DEMO_LISTINGS', 'true');
  vi.stubEnv('SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  vi.stubEnv('REQUIRE_HOSTED_SERVICES', '');
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe('demo seed switch across server surfaces', () => {
  it('hides every seeded listing while keeping the user-created row', async () => {
    const sample = fixtureListings.find((listing) => listing.slug === 'land-cruiser-kish')!;

    const admin = await adminCenterData();
    expect(admin.listings.map((listing) => listing.id)).toEqual([userListing.id]);

    const moderation = await moderationQueues();
    expect(moderation.overview.listings).toBe(1);
    expect(moderation.stories.map((story) => story.slug)).toEqual([userListing.slug]);

    expect(await loadSellerProfile(sample.sellerId)).toBeNull();
    const profile = await loadSellerProfile(userListing.sellerId);
    expect(profile?.listings.map((listing) => listing.id)).toEqual([userListing.id]);
    expect(profile?.stories.map((story) => story.slug)).toEqual([userListing.slug]);

    const rail = storiesFrom(visibleCatalog(fixtureListings, devListings()), [], [], 20);
    expect(rail.map((story) => story.slug)).toEqual([userListing.slug]);
  });
});
