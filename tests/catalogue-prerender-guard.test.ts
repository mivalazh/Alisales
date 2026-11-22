import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetHostedCatalogCache, searchPublicListings } from '../apps/web/lib/data/listings';

/**
 * The env guard in `next.config.ts` catches a build with no credentials at all.
 * These tests cover the case it cannot see: credentials that are present but
 * the read still yields nothing — wrong key, unreachable project, migrations
 * not applied. The seed is hidden in production, so that build would prerender
 * and cache empty catalogue HTML; `cataloguePrerenderIssue` turns it into a
 * failed build instead. The same read must stay quiet at runtime, where an
 * empty marketplace is legitimate.
 */

const ENV_KEYS = [
  'NODE_ENV',
  'NEXT_PHASE',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_HIDE_DEMO_LISTINGS',
  'ALLOW_EMPTY_CATALOGUE',
  'DEMO_DATA_DIR',
] as const;

const saved = new Map<string, string | undefined>();
const originalFetch = globalThis.fetch;
let dataDir = '';

function json(rows: unknown[]): Response {
  return new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function stubFetch(handler: () => Promise<Response> | Response): void {
  globalThis.fetch = vi.fn(handler) as unknown as typeof fetch;
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  dataDir = mkdtempSync(join(tmpdir(), 'alisales-prerender-'));
  process.env.DEMO_DATA_DIR = dataDir;
  process.env.NODE_ENV = 'production';
  process.env.NEXT_PHASE = 'phase-production-build';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  resetHostedCatalogCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  dataDir = '';
  resetHostedCatalogCache();
});

describe('catalogue prerender guard', () => {
  it('fails the build when the hosted catalogue answers with no rows', async () => {
    stubFetch(() => json([]));

    await expect(searchPublicListings()).rejects.toThrow(
      /^Refusing to prerender an empty public catalogue: the hosted catalogue returned no rows/,
    );
  });

  it('fails the build when the read itself fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(() => {
      throw new Error('getaddrinfo ENOTFOUND project.supabase.co');
    });

    try {
      await expect(searchPublicListings()).rejects.toThrow(
        /^Refusing to prerender an empty public catalogue: the read failed/,
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('stays quiet at runtime, where an empty marketplace is legitimate', async () => {
    process.env.NEXT_PHASE = 'phase-production-server';
    stubFetch(() => json([]));

    await expect(searchPublicListings()).resolves.toEqual([]);
  });

  it('honours the ALLOW_EMPTY_CATALOGUE opt-out for an intentional empty build', async () => {
    process.env.ALLOW_EMPTY_CATALOGUE = 'true';
    stubFetch(() => json([]));

    await expect(searchPublicListings()).resolves.toEqual([]);
  });
});
