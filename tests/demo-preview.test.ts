import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AED_TO_IRR, DEFAULT_FILTERS, irrToAED, irrToToman, postingAgeLabel } from '@alisales/schemas';
import {
  demoAuthMode,
  demoDataDir,
  demoOtpHintEnabled,
  fixtureMode,
  hostedDataConfigured,
  requireHostedServices,
} from '../apps/web/lib/config/mode';
import { fixtureListings } from '../apps/web/lib/data/fixtures';
import { applyFiltersLocally } from '../apps/web/lib/data/listings';

const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SMS_API_KEY',
  'SMS_SENDER',
  'SMS_API_URL',
  'REQUIRE_HOSTED_SERVICES',
  'NEXT_PUBLIC_DEMO_OTP_HINT',
] as const;

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('cloud fallback without hosted credentials', () => {
  it('is fixture mode when nothing is configured', () => {
    expect(hostedDataConfigured()).toBe(false);
    expect(fixtureMode()).toBe(true);
    expect(demoAuthMode()).toBe(true);
  });

  it('becomes hosted as soon as Supabase write credentials exist', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    expect(hostedDataConfigured()).toBe(true);
    expect(fixtureMode()).toBe(false);
    expect(demoAuthMode()).toBe(false);
  });

  it('REQUIRE_HOSTED_SERVICES=true refuses the fallback', () => {
    process.env.REQUIRE_HOSTED_SERVICES = 'true';
    expect(requireHostedServices()).toBe(true);
    expect(fixtureMode()).toBe(false);
    expect(demoAuthMode()).toBe(false);
    expect(demoOtpHintEnabled()).toBe(false);
  });

  it('a configured SMS provider disables the demo login path', () => {
    process.env.SMS_API_KEY = 'key';
    process.env.SMS_SENDER = '1000';
    process.env.SMS_API_URL = 'https://sms.example';
    expect(fixtureMode()).toBe(true); // data still fixture
    expect(demoAuthMode()).toBe(false);
  });

  it('the OTP hint needs the explicit public flag', () => {
    expect(demoOtpHintEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_DEMO_OTP_HINT = 'true';
    expect(demoOtpHintEnabled()).toBe(true);
    process.env.REQUIRE_HOSTED_SERVICES = '1';
    expect(demoOtpHintEnabled()).toBe(false);
  });

  it('the demo store lives in a writable directory', () => {
    const dir = demoDataDir();
    expect(dir === join(process.cwd(), '.dev-data') || dir.includes('alisales-demo-data')).toBe(true);
    expect(existsSync(dir)).toBe(true);
  });
});

describe('luxury first-impression catalogue', () => {
  const browsed = applyFiltersLocally(fixtureListings, DEFAULT_FILTERS);

  it('opens on the featured Land Cruiser, then the import inventory', () => {
    expect(browsed[0]?.slug).toBe('land-cruiser-kish');
    const topSlugs = browsed.slice(0, 5).map((l) => l.slug);
    expect(topSlugs).toEqual(
      expect.arrayContaining(['patrol-platinum-kish', 's-class-kish', 'bmw-x5-kish']),
    );
  });

  it('carries the five luxury cars and two luxury parts', () => {
    const cars = fixtureListings.filter((l) => l.kind !== 'part' && l.priceIRR > 200_000_000_000);
    expect(cars.map((l) => l.slug)).toEqual(
      expect.arrayContaining([
        'land-cruiser-kish',
        'patrol-platinum-kish',
        's-class-kish',
        'bmw-x5-kish',
        'cayenne-kish',
      ]),
    );
    const parts = fixtureListings.filter((l) => l.kind === 'part');
    expect(parts).toHaveLength(2);
    expect(parts.every((p) => p.part && p.part.origin === 'original')).toBe(true);
  });

  it('ends the grid with exactly one sold listing', () => {
    expect(browsed.filter((l) => l.state === 'sold')).toHaveLength(1);
    expect(browsed.at(-1)?.slug).toBe('dena-plus-sold');
  });

  it('shows today, yesterday and 3-day-old labels', () => {
    const ages = fixtureListings.map((l) => postingAgeLabel(l.publishedAt ?? Date.now()));
    expect(ages).toContain('امروز');
    expect(ages).toContain('دیروز');
    expect(ages).toContain('3 روز پیش');
  });

  it('has a real cover file for every illustrated listing (no broken images)', () => {
    const covers = fixtureListings
      .map((l) => l.coverUrl)
      .filter((url): url is string => Boolean(url && url.startsWith('/covers/')));
    expect(covers.length).toBeGreaterThanOrEqual(7);
    for (const url of new Set(covers)) {
      const file = join(process.cwd(), 'apps/web/public', url.replace(/^\//, ''));
      expect(existsSync(file), url).toBe(true);
    }
  });

  it('keeps real AED reference prices next to the Toman amount', () => {
    const cruiser = fixtureListings.find((l) => l.slug === 'land-cruiser-kish')!;
    expect(irrToAED(cruiser.priceIRR)).toBe(1_250_000);
    expect(cruiser.priceIRR).toBe(1_250_000 * AED_TO_IRR);
    expect(irrToToman(cruiser.priceIRR)).toBe(34_000_000_000);
  });
});
