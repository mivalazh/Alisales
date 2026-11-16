import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: supabase.from }),
}));

import { getListing } from '../apps/web/lib/data/listings';
import { fixtureListings } from '../apps/web/lib/data/fixtures';

const saved = new Map<string, string | undefined>();
const KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

beforeEach(() => {
  for (const key of KEYS) {
    saved.set(key, process.env[key]);
    process.env[key] = key.endsWith('URL') ? 'https://example.supabase.co' : 'anon-key';
  }
  supabase.from.mockReset();
});

afterEach(() => {
  for (const key of KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

describe('listing detail resolution', () => {
  const seeded = fixtureListings.find((listing) => listing.slug === 'camaro-kish');

  it('resolves a seeded slug, its URL-encoded form and its UUID from fixtures', async () => {
    expect(seeded).toBeDefined();
    supabase.from.mockImplementation(() => {
      throw new Error('production view unavailable');
    });

    await expect(getListing('camaro-kish')).resolves.toMatchObject({
      id: seeded!.id,
      slug: 'camaro-kish',
    });
    await expect(getListing('camaro%2Dkish')).resolves.toMatchObject({
      id: seeded!.id,
    });
    await expect(getListing(seeded!.id)).resolves.toMatchObject({
      id: seeded!.id,
    });
  });

  it('falls back to fixture detail instead of throwing when the hosted read rejects', async () => {
    supabase.from.mockImplementation(() => {
      throw new Error('network down');
    });

    await expect(getListing('land-cruiser-kish')).resolves.toMatchObject({
      slug: 'land-cruiser-kish',
      photos: expect.any(Array),
    });
  });
});
