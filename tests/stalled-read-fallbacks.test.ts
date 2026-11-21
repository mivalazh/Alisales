import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTERS } from '@alisales/schemas';

/**
 * Page-level proof for the 2.5s read budget: when a hosted read dies (the abort
 * surfaces as a rejected query), the pages that call these helpers keep
 * rendering — the grid falls back to the seeded catalogue and the personalised
 * follow list falls back to empty — instead of throwing to error.tsx.
 */

const rpc = vi.hoisted(() => vi.fn());
const followedQuery = vi.hoisted(() => vi.fn());

const abortError = () => {
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';
  return error;
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('@supabase/supabase-js');
  vi.doUnmock('../apps/web/lib/data/s2-store');
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

describe('catalogue grid falls back to seeded rows', () => {
  it('returns seeded listings when search_listings is aborted', async () => {
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({ rpc }),
    }));
    rpc.mockReset();
    rpc.mockRejectedValue(abortError());
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    const { searchListings } = await import('../apps/web/lib/data/listings');
    const rows = await searchListings(DEFAULT_FILTERS, 'car');

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.kind !== 'part')).toBe(true);
    expect(rpc).toHaveBeenCalled();
  });
});

describe('followed sellers fall back to an empty list', () => {
  it('returns [] when the hosted follow read is aborted', async () => {
    vi.doMock('../apps/web/lib/data/s2-store', () => ({
      admin: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => followedQuery(),
            }),
          }),
        }),
      }),
    }));
    followedQuery.mockReset();
    followedQuery.mockRejectedValue(abortError());

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { followedSellerIds } = await import('../apps/web/lib/data/social-store');

    await expect(followedSellerIds('user-1')).resolves.toEqual([]);
    expect(followedQuery).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});
