import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import HomePage from './page';
import SellerPage, { generateMetadata as sellerMetadata } from './seller/[id]/page';
import AdminPage from './admin/page';
import { fixtureListings } from '../lib/data/fixtures';
import { devListings } from '../lib/data/dev-store';

/**
 * Route-level launch-switch coverage.
 *
 * These tests render the actual page modules with the flag on. Request and
 * presentation boundaries are mocked, but the seller, admin and story data
 * paths stay real, so a page cannot silently bypass `visibleCatalog`.
 */

vi.mock('next/link', async () => {
  const { createElement: h } = await import('react');
  return {
    default: ({ href, children }: { href?: string; children?: unknown }) =>
      h('a', { href }, children as never),
  };
});

vi.mock('next/image', async () => {
  const { createElement: h } = await import('react');
  return {
    default: ({ src, alt }: { src?: unknown; alt?: unknown }) =>
      h('img', { src: String(src), alt: String(alt ?? '') }),
  };
});

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
}));

vi.mock('@/components/Catalog', async () => {
  const { createElement: h } = await import('react');
  return {
    Catalog: ({
      listings,
      stories,
    }: {
      listings: Array<{ slug: string }>;
      stories: Array<{ slug: string; title: string }>;
    }) =>
      h(
        'section',
        { 'data-testid': 'catalog' },
        h(
          'div',
          { 'data-testid': 'stories' },
          ...stories.map((story) =>
            h('span', { key: story.slug, 'data-story': story.slug }, story.title),
          ),
        ),
        h(
          'div',
          { 'data-testid': 'listings' },
          ...listings.map((listing) => h('span', { key: listing.slug }, listing.slug)),
        ),
      ),
  };
});

vi.mock('@/components/AdminDashboard', async () => {
  const { createElement: h } = await import('react');
  return {
    AdminDashboard: ({
      data,
    }: {
      data: { listings: Array<{ id: string; title: string }> };
    }) =>
      h(
        'section',
        { 'data-testid': 'admin-catalogue' },
        ...data.listings.map((listing) =>
          h('span', { key: listing.id, 'data-admin-listing': listing.id }, listing.title),
        ),
      ),
  };
});

vi.mock('@/components/CategorySwitch', () => ({ CategorySwitch: () => null }));
vi.mock('@/components/Icon', () => ({ Icon: () => null }));
vi.mock('@/components/NativeBackHeader', () => ({ NativeBackHeader: () => null }));
vi.mock('@/components/FollowSellerButton', () => ({ FollowSellerButton: () => null }));
vi.mock('@/components/SellerActions', () => ({ SellerActions: () => null }));
vi.mock('@/components/Stories', () => ({ Stories: () => null }));
vi.mock('@/components/SellerVerified', () => ({ VerifiedPill: () => null }));

vi.mock('@/lib/auth/session', () => ({
  getSession: async () => null,
}));

vi.mock('@/lib/admin/guard', () => ({
  adminGate: async () => ({
    session: {
      sub: 'route-admin',
      phone: '09120000000',
      displayName: 'Route Admin',
      accountType: 'individual',
      exp: Date.now() + 60_000,
    },
    access: 'admin' as const,
  }),
}));

vi.mock('@/lib/i18n/server', () => ({
  getLanguage: async () => 'en',
  serverT: (_lang: string, fa: string, en?: string) => en ?? fa,
}));

vi.mock('@/lib/data/social-store', () => ({
  followedSellerIds: () => [],
  isFollowing: () => false,
  followerCount: () => 0,
  profileCustomization: () => null,
}));

vi.mock('@/lib/data/my-listings-cookie', () => ({
  readMyListings: async () => [],
  mergeMyListings: (_mine: unknown, listings: unknown[]) => [...listings],
}));

vi.mock('@/lib/data/dev-store', async () => {
  const { fixtureListings: seeds } = await import('@/lib/data/fixtures');
  const userListing = {
    ...seeds[0]!,
    id: 'user-created-listing',
    slug: 'user-created-listing',
    sellerId: 'user-created-seller',
    model: 'Route User Car',
    trim: null,
    featured: false,
    showroomName: null,
    showroomVerified: false,
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

vi.mock('@/lib/data/rate-store', () => ({
  getAedRate: async () => ({
    aedToIrr: 272_000,
    updatedAt: '2026-11-14T00:00:00.000Z',
    source: 'default' as const,
  }),
}));

vi.mock('@/lib/storage/demo-store', () => ({
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
    if (!saved.has(key)) saved.set(key, process.env[key]);
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

const sampleSeed = fixtureListings.find((listing) => listing.slug === 'land-cruiser-kish')!;
const user = devListings()[0]!;

describe('flag-on routes', () => {
  it('home renders only the user-created story and listing', async () => {
    const html = renderToStaticMarkup(
      await HomePage({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain('data-story="user-created-listing"');
    expect(html).toContain('user-created-listing');
    expect(html).not.toContain('data-story="land-cruiser-kish"');
    expect(html).not.toContain('Land Cruiser VXR');
  });

  it('gates both hidden fixture and personal seller routes', async () => {
    await expect(
      SellerPage({
        params: Promise.resolve({ id: sampleSeed.sellerId }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    // The user-created seller is personal, so their public seller URL is a 404.
    await expect(
      SellerPage({
        params: Promise.resolve({ id: user.sellerId }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    const metadata = await sellerMetadata({
      params: Promise.resolve({ id: user.sellerId }),
    });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('admin page renders only the user-created catalogue row', async () => {
    const html = renderToStaticMarkup(await AdminPage());

    expect(html).toContain('data-admin-listing="user-created-listing"');
    expect(html).not.toContain(sampleSeed.slug);
    expect(html).not.toContain(sampleSeed.id);
  });
});
