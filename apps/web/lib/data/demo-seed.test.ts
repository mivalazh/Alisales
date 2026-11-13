import { afterEach, describe, expect, it } from 'vitest';
import { fixtureListings } from './fixtures';
import { visibleCatalog } from './demo-seed';
import { storiesFrom } from '../stories';
import type { ListingCardData } from './listings';

const ENV_KEY = 'NEXT_PUBLIC_HIDE_DEMO_LISTINGS';

const sampleSeed = fixtureListings[0]!;

const userListing: ListingCardData = {
  ...sampleSeed,
  id: 'user-created-listing',
  slug: 'user-created-listing',
  sellerId: 'user-created-seller',
  brand: 'toyota',
  model: 'User Created',
};

afterEach(() => {
  delete process.env[ENV_KEY];
});

describe('demo listing launch switch', () => {
  it('removes every seeded sample while keeping user-created listings', () => {
    process.env[ENV_KEY] = 'true';

    const visible = visibleCatalog(fixtureListings, [userListing]);

    expect(fixtureListings.length).toBeGreaterThan(0);
    expect(visible).toHaveLength(1);
    expect(visible.map((listing) => listing.id)).toEqual(['user-created-listing']);
    expect(visible.some((listing) => listing.sellerId === 'user-created-seller')).toBe(true);
    expect(visible.some((listing) => fixtureListings.some((seed) => seed.id === listing.id))).toBe(false);
  });

  it('drops seeded story picks while keeping user-created stories', () => {
    process.env[ENV_KEY] = 'true';

    const cases = visibleCatalog(fixtureListings, [userListing]);
    const stories = storiesFrom(cases, [], [sampleSeed.slug], 8);

    expect(stories.map((story) => story.slug)).toEqual(['user-created-listing']);
    expect(stories.some((story) => story.slug === sampleSeed.slug)).toBe(false);
  });

  it('keeps the seeded catalogue while the flag is off', () => {
    delete process.env[ENV_KEY];

    const visible = visibleCatalog(fixtureListings, [userListing]);

    expect(visible).toHaveLength(fixtureListings.length + 1);
    expect(visible.some((listing) => listing.slug === sampleSeed.slug)).toBe(true);
    expect(visible.some((listing) => listing.id === 'user-created-listing')).toBe(true);
  });
});
