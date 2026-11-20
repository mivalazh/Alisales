import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The hosted reads used to swallow Supabase errors and return the same
 * `null` / `[]` they return for a genuinely empty result, so a transient outage
 * looked like "you have no favorites / no notifications / no account". These
 * tests pin the new contract: a provider failure raises `DataUnavailableError`,
 * real emptiness still returns empty data, and a route answers 503 — never 200
 * with an empty list.
 */

const fake = vi.hoisted(() => ({
  error: null as { message: string } | null,
  tables: [] as string[],
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(table: string) {
      fake.tables.push(table);
      const result = { data: null, error: fake.error };
      // Any chain (`select().eq().maybeSingle()`, `select().order()`) resolves to
      // the same result when awaited, which is how the data layer uses it.
      const chain = (): unknown =>
        new Proxy(
          {},
          {
            get(_target, property) {
              if (property === 'then') {
                return (resolve: (value: unknown) => unknown) => resolve(result);
              }
              if (property === 'maybeSingle' || property === 'single') {
                return async () => result;
              }
              return () => chain();
            },
          },
        );
      return chain();
    },
    rpc: () => chainableResult(),
    storage: { from: () => chainableResult() },
  }),
}));

/** The RPC builder is a separate shape: awaited directly, never chained. */
function chainableResult(): unknown {
  const result = { data: null, error: fake.error };
  return {
    then: (resolve: (value: unknown) => unknown) => resolve(result),
  };
}

vi.mock('@/lib/auth/session', () => ({
  getSession: async () => ({
    sub: 'user-1',
    phone: '09120000001',
    displayName: 'تست',
    accountType: 'individual',
  }),
}));

const store = await import('../apps/web/lib/data/s2-store');
const social = await import('../apps/web/lib/data/social-store');
const notifications = await import('../apps/web/lib/data/notification-store');
const { isDataUnavailable } = await import('../apps/web/lib/data/unavailable');
const { GET: favoritesGet } = await import('../apps/web/app/api/favorites/route');

const ENV_KEYS = ['NODE_ENV', 'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  process.env.SUPABASE_URL = 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  fake.error = null;
  fake.tables.length = 0;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

async function expectUnavailable(work: () => Promise<unknown>, source: string): Promise<void> {
  const error = await work().then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).not.toBeNull();
  expect(isDataUnavailable(error)).toBe(true);
  expect(error).toMatchObject({ code: 'DATA_UNAVAILABLE', source });
}

describe('data layer: unavailable vs empty', () => {
  it('keeps genuine emptiness empty', async () => {
    await expect(store.findUserByPhone('09120000001')).resolves.toBeNull();
    await expect(store.listFavoriteRows('user-1')).resolves.toEqual([]);
    await expect(store.conversationsForUser('user-1')).resolves.toEqual([]);
    await expect(store.messagesForConversation('c-1')).resolves.toEqual([]);
    await expect(social.profileCustomization('user-1')).resolves.toBeNull();
    await expect(notifications.listListingEvents(['l-1'])).resolves.toEqual([]);
    await expect(notifications.notificationReadAt('user-1')).resolves.toBeNull();
  });

  it('raises a typed unavailable error for every read that depends on Supabase', async () => {
    fake.error = { message: 'connection reset' };

    await expectUnavailable(() => store.findUserByPhone('09120000001'), 'users');
    await expectUnavailable(() => store.listFavoriteRows('user-1'), 'favorites');
    await expectUnavailable(() => store.conversationsForUser('user-1'), 'conversations');
    await expectUnavailable(() => store.messagesForConversation('c-1'), 'messages');
    await expectUnavailable(() => social.profileCustomization('user-1'), 'profiles');
    await expectUnavailable(() => notifications.listListingEvents(['l-1']), 'notifications');
    await expectUnavailable(() => notifications.notificationReadAt('user-1'), 'notifications');
  });

  it('refuses to answer "marked read" when neither write stored the marker', async () => {
    fake.error = { message: 'rpc unavailable' };

    await expectUnavailable(() => notifications.markNotificationsRead('user-1'), 'notifications');
  });

  it('never leaks the provider message', async () => {
    fake.error = { message: 'relation "listing_favorites" does not exist' };

    const error = await store.listFavoriteRows('user-1').catch((thrown: unknown) => thrown);
    expect(String((error as Error).message)).not.toContain('relation');
  });
});

describe('routes: an outage is a 503, not an empty list', () => {
  it('answers 503 with a retryable code', async () => {
    fake.error = { message: 'connection reset' };

    const response = await favoritesGet();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('15');
    expect(body).toMatchObject({
      ok: false,
      code: 'DATA_UNAVAILABLE',
      retryable: true,
    });
    expect(JSON.stringify(body)).not.toContain('connection reset');
  });

  it('still answers 200 with ids when the store is healthy', async () => {
    const response = await favoritesGet();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ids: [] });
  });
});
