import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTERS } from '@alisales/schemas';

/**
 * The SQL side is proven in `vehicle-category-rpc.test.ts`. This proves the app
 * actually asks for it: a hosted /motorcycles or /heavy read must put the page
 * category in the RPC payload, or the database would hand back the car page and
 * the browser would narrow 48 rows after the fact.
 */

const rpc = vi.hoisted(() => vi.fn());

const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;
const savedEnv = new Map<string, string | undefined>();

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing-1',
    slug: 'hosted-bike',
    seller_id: 'seller',
    price_irr: 1_000_000,
    city: 'kish',
    state: 'active',
    featured: false,
    published_at: '2026-01-01T00:00:00.000Z',
    has_report: false,
    brand: 'bmw',
    model: 'S 1000 RR',
    trim: null,
    year: 1402,
    mileage_km: 10_000,
    gearbox: 'automatic',
    fuel: 'petrol',
    color: 'white',
    condition: 'used',
    plate_type: 'standard',
    cover_photo_path: null,
    showroom_name: null,
    showroom_verified: false,
    allow_phone_reveal: false,
    kind: 'vehicle',
    category: 'motorcycle',
    engine_cc: 900,
    bike_type: 'sport',
    heavy_type: null,
    working_hours: null,
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  vi.resetModules();
  rpc.mockReset();
  vi.doMock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }));
});

afterEach(() => {
  vi.doUnmock('@supabase/supabase-js');
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
});

describe('hosted category reads', () => {
  it('sends the page category to search_listings', async () => {
    rpc.mockResolvedValue({ data: [row()], error: null });
    const { searchPublicListings } = await import('../apps/web/lib/data/listings');

    const rows = await searchPublicListings(DEFAULT_FILTERS, 'motorcycle');

    expect(rpc).toHaveBeenCalledWith(
      'search_listings',
      expect.objectContaining({
        p_filters: expect.objectContaining({ category: 'motorcycle' }),
      }),
    );
    // The specs survive the row mapping, so the card and filters see them.
    expect(rows[0]).toMatchObject({ category: 'motorcycle', engineCc: 900, bikeType: 'sport' });
  });

  it('leaves the category out of an unfiltered home read', async () => {
    rpc.mockResolvedValue({ data: [row({ category: 'car', body_type: 'suv' })], error: null });
    const { searchPublicListings } = await import('../apps/web/lib/data/listings');

    const rows = await searchPublicListings(DEFAULT_FILTERS);

    const payload = rpc.mock.calls[0]?.[1]?.p_filters;
    expect(payload).not.toHaveProperty('category');
    // The body class reaches the card too, so the drawer and the chips agree.
    expect(rows[0]).toMatchObject({ category: 'car', bodyType: 'suv' });
  });
});
