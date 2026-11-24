import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListingPublish } from '@alisales/schemas';

/**
 * The body-class filter reads `vehicles.body_type`, and the mobile form has no
 * picker for it, so a hosted row would store `null` and stay invisible to
 * «شاسی‌بلند» / «سدان». `createListing` stores the same model inference the web
 * publish path and the 0016 backfill use.
 */

const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];

const ENV_KEYS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;
const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  inserts.length = 0;
  vi.resetModules();
  vi.doMock('./supabase-client', () => ({
    createMobileSupabaseClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: 'seller-1' } }, error: null }),
      },
      from: (table: string) => ({
        insert: (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return {
            select: () => ({
              single: async () => ({
                data:
                  table === 'vehicles'
                    ? { id: 'vehicle-1' }
                    : {
                        id: 'listing-1',
                        slug: 'a-test',
                        price_irr: 10_000_000_000,
                        state: 'pending_review',
                        published_at: null,
                      },
                error: null,
              }),
            }),
          };
        },
      }),
    }),
  }));
});

afterEach(() => {
  vi.doUnmock('./supabase-client');
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  savedEnv.clear();
});

function publish(overrides: {
  model: string;
  bodyType?: ListingPublish['vehicle']['bodyType'];
}): ListingPublish {
  return {
    vehicle: {
      brand: 'toyota',
      model: overrides.model,
      trim: null,
      year: 1402,
      mileageKm: 1000,
      gearbox: 'automatic',
      fuel: 'petrol',
      color: 'white',
      bodyType: overrides.bodyType ?? null,
      condition: 'used',
      plateType: 'kish',
      thirdPartyInsurance: null,
      thirdPartyMonths: null,
      bodyInsurance: null,
      bodyMonths: null,
      paintCondition: null,
      chassisCondition: null,
      technicalInspection: null,
      isJournalPhoto: false,
      inspectionSheetUrl: null,
      inspectionNote: null,
      vin: null,
    },
    priceIRR: 10_000_000_000,
    city: 'kish',
    description: 'آگهی آزمایشی',
    photos: [],
    showroomId: null,
    allowPhoneReveal: true,
    hideAed: false,
  };
}

async function storedBodyType(data: ListingPublish): Promise<unknown> {
  const { createListing } = await import('./api');
  await createListing(data);
  const vehicle = inserts.find((entry) => entry.table === 'vehicles');
  if (!vehicle) throw new Error('no vehicle row inserted');
  return vehicle.row.body_type;
}

describe('mobile createListing stores a body class', () => {
  it('infers it when the seller has no picker value', async () => {
    expect(await storedBodyType(publish({ model: 'Land Cruiser' }))).toBe('suv');
  });

  it('never overrides an explicit pick', async () => {
    expect(await storedBodyType(publish({ model: 'Land Cruiser', bodyType: 'sedan' }))).toBe(
      'sedan',
    );
  });

  it('stores null when the model matches nothing', async () => {
    expect(await storedBodyType(publish({ model: 'تیبا' }))).toBeNull();
  });
});
