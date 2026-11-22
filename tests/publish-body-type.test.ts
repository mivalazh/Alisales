import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ListingPublish } from '@alisales/schemas';

/**
 * The body-class filter reads `vehicles.body_type`, so a new car published
 * without the optional pick would be invisible to it — the same gap 0016 fixes
 * for legacy rows. Publish now stores the same model inference the grid uses,
 * and only for cars: a bike or machine has no body class.
 */

const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  inserts.length = 0;
  vi.resetModules();
  vi.doMock('@supabase/supabase-js', () => ({
    createClient: () => ({
      from: (table: string) => ({
        insert: (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return {
            select: () => ({
              single: async () => ({ data: { id: `${table}-id` }, error: null }),
            }),
          };
        },
      }),
    }),
  }));
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

function publish(overrides: {
  model: string;
  bodyType?: ListingPublish['vehicle']['bodyType'];
  category?: ListingPublish['category'];
}): ListingPublish {
  return {
    kind: 'vehicle',
    category: overrides.category ?? 'car',
    priceIRR: 10_000_000_000,
    city: 'kish',
    description: 'آگهی آزمایشی',
    allowPhoneReveal: true,
    photos: [],
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
    },
  } as ListingPublish;
}

async function storedBodyType(data: ListingPublish): Promise<unknown> {
  const { publishHosted } = await import('../apps/web/lib/data/publish-store');
  await publishHosted({ kind: 'vehicle', data, sellerId: 'seller-1' });
  const vehicle = inserts.find((entry) => entry.table === 'vehicles');
  if (!vehicle) throw new Error('no vehicle row inserted');
  return vehicle.row.body_type;
}

describe('hosted publish stores a body class', () => {
  it('infers it when the seller skipped the optional pick', async () => {
    expect(await storedBodyType(publish({ model: 'Land Cruiser' }))).toBe('suv');
  });

  it('never overrides an explicit pick', async () => {
    expect(await storedBodyType(publish({ model: 'Land Cruiser', bodyType: 'sedan' }))).toBe(
      'sedan',
    );
  });

  it('leaves a motorcycle without one', async () => {
    expect(
      await storedBodyType(publish({ model: 'Land Cruiser', category: 'motorcycle' })),
    ).toBeNull();
  });
});
