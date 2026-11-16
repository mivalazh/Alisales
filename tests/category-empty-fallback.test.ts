import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTERS } from '@alisales/schemas';

const supabase = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc: supabase.rpc }),
}));

import { searchListings } from '../apps/web/lib/data/listings';

const saved = new Map<string, string | undefined>();
const KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

beforeEach(() => {
  for (const key of KEYS) {
    saved.set(key, process.env[key]);
    process.env[key] = key.endsWith('URL') ? 'https://example.supabase.co' : 'anon-key';
  }
  supabase.rpc.mockReset();
  supabase.rpc.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  for (const key of KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

describe('empty hosted catalogue fallback by category', () => {
  it.each(['car', 'motorcycle', 'heavy'] as const)(
    'serves seeded %s rows instead of an empty grid',
    async (category) => {
      const rows = await searchListings(DEFAULT_FILTERS, category);

      expect(rows.length).toBeGreaterThan(0);
      expect(
        rows.every((row) => row.kind !== 'part' && (row.category ?? 'car') === category),
      ).toBe(true);
    },
  );

  it('serves seeded parts for the mixed /parts query', async () => {
    const rows = await searchListings(DEFAULT_FILTERS);

    expect(rows.some((row) => row.kind === 'part')).toBe(true);
  });
});
