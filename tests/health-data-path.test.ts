import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `/api/health` must prove the production data path, not just that the secret
 * names exist: one row round-tripped through Supabase and one object through
 * the photo bucket. These tests drive a fake client so a missing service-role
 * key, an unapplied migration or a missing bucket each fail as their own check.
 */

interface FakeError {
  message: string;
  code?: string;
  statusCode?: number;
}

const fake = vi.hoisted(() => ({
  rows: new Map<string, { id: string; note: string }>(),
  objects: new Map<string, string>(),
  calls: [] as string[],
  dbError: null as FakeError | null,
  bucketError: null as FakeError | null,
  deleteError: null as FakeError | null,
  tamperDownload: false,
  /** Simulates a trigger rewriting the stored note after the insert. */
  tamperRowNote: false,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(table: string) {
      return {
        insert(row: { note: string }) {
          fake.calls.push(`insert:${table}`);
          if (fake.dbError) {
            return { select: () => ({ single: async () => ({ data: null, error: fake.dbError }) }) };
          }
          const id = `probe-${fake.rows.size + 1}`;
          const stored = fake.tamperRowNote ? 'rewritten-by-a-trigger' : row.note;
          fake.rows.set(id, { id, note: stored });
          return {
            select: () => ({
              single: async () => ({ data: { id, note: row.note }, error: null }),
            }),
          };
        },
        select() {
          return {
            eq(_column: string, id: string) {
              fake.calls.push(`select:${table}`);
              return {
                maybeSingle: async () => ({ data: fake.rows.get(id) ?? null, error: null }),
              };
            },
          };
        },
        delete() {
          return {
            eq(_column: string, id: string) {
              fake.calls.push(`delete:${table}`);
              if (fake.deleteError) return Promise.resolve({ error: fake.deleteError });
              fake.rows.delete(id);
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        fake.calls.push(`bucket:${bucket}`);
        return {
          upload: async (path: string, bytes: Uint8Array) => {
            fake.calls.push(`upload:${bucket}`);
            if (fake.bucketError) return { data: null, error: fake.bucketError };
            fake.objects.set(path, new TextDecoder().decode(bytes));
            return { data: { path }, error: null };
          },
          download: async (path: string) => {
            fake.calls.push(`download:${bucket}`);
            const text = fake.objects.get(path);
            if (text === undefined) {
              return { data: null, error: { message: 'Object not found', statusCode: 404 } };
            }
            const body = fake.tamperDownload ? `${text}-tampered` : text;
            return { data: { text: async () => body }, error: null };
          },
          remove: async (paths: string[]) => {
            fake.calls.push(`remove:${bucket}`);
            if (fake.deleteError) return { data: null, error: fake.deleteError };
            for (const path of paths) fake.objects.delete(path);
            return { data: {}, error: null };
          },
        };
      },
    },
  }),
}));

const { GET } = await import('../apps/web/app/api/health/route');
const probes = await import('../apps/web/lib/health/data-probes');

const ENV_KEYS = [
  'NODE_ENV',
  'AUTH_SECRET',
  'INSTANT_OTP_ALLOWLIST',
  'SMS_IR_API_KEY',
  'SMS_IR_TEMPLATE_ID',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'REQUIRE_HOSTED_SERVICES',
] as const;

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  fake.rows.clear();
  fake.objects.clear();
  fake.calls.length = 0;
  fake.dbError = null;
  fake.bucketError = null;
  fake.deleteError = null;
  fake.tamperDownload = false;
  fake.tamperRowNote = false;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

function hostedEnv(): void {
  process.env.NODE_ENV = 'production';
  process.env.AUTH_SECRET = '1234567890abcdef';
  process.env.INSTANT_OTP_ALLOWLIST = '09120000001';
  process.env.SUPABASE_URL = 'https://fake.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
}

describe('health data path', () => {
  it('round-trips one row and one object and leaves nothing behind', async () => {
    hostedEnv();

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checks.database).toMatchObject({ ok: true, table: 'health_probes' });
    expect(body.checks.storage).toMatchObject({ ok: true, bucket: 'photos' });
    expect(typeof body.checks.database.roundTripMs).toBe('number');

    // The probe row and the probe object are removed again.
    expect(fake.rows.size).toBe(0);
    expect(fake.objects.size).toBe(0);
    expect(fake.calls).toEqual(
      expect.arrayContaining([
        'insert:health_probes',
        'select:health_probes',
        'delete:health_probes',
        'upload:photos',
        'download:photos',
        'remove:photos',
      ]),
    );
  });

  it('fails both checks loudly when the service-role key is missing', async () => {
    hostedEnv();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await GET();
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.checks.database).toMatchObject({
      ok: false,
      code: 'SUPABASE_SERVICE_ROLE_KEY_MISSING',
    });
    expect(body.checks.storage).toMatchObject({
      ok: false,
      code: 'SUPABASE_SERVICE_ROLE_KEY_MISSING',
    });
    // Nothing was attempted against a half-configured project.
    expect(fake.calls).toEqual([]);
    expect(text).not.toContain('service-role-key');
  });

  it('names the missing bucket instead of reporting a generic failure', async () => {
    hostedEnv();
    fake.bucketError = { message: 'Bucket not found', statusCode: 404 };

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.checks.database.ok).toBe(true);
    expect(body.checks.storage).toMatchObject({
      ok: false,
      bucket: 'photos',
      code: 'STORAGE_BUCKET_MISSING',
    });
  });

  it('names an unapplied migration on the database check', async () => {
    hostedEnv();
    fake.dbError = {
      message: "Could not find the table 'public.health_probes' in the schema cache",
      code: 'PGRST205',
    };

    const response = await GET();
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(503);
    expect(body.checks.database).toMatchObject({
      ok: false,
      code: 'SUPABASE_TABLE_MISSING',
    });
    expect(body.checks.storage.ok).toBe(true);
    // The provider message stays in the server log, not on the public body.
    expect(text).not.toContain('Could not find the table');
  });

  it('rejects a row that does not read back with the probe token', async () => {
    hostedEnv();
    fake.tamperRowNote = true;

    const check = await probes.probeDatabase();

    expect(check).toMatchObject({ ok: false, code: 'SUPABASE_READ_MISMATCH' });
    // The write is proven broken, and the probe row is still cleaned up.
    expect(fake.rows.size).toBe(0);
  });

  it('rejects an object that downloads with different bytes', async () => {
    hostedEnv();
    fake.tamperDownload = true;

    const check = await probes.probeStorage();

    expect(check).toMatchObject({ ok: false, code: 'STORAGE_READ_MISMATCH' });
    // The tampered object is still removed.
    expect(fake.objects.size).toBe(0);
  });

  it('skips both probes on a fixture-mode development build', async () => {
    process.env.NODE_ENV = 'development';

    const checks = await probes.dataPathChecks();

    expect(probes.dataProbesRequired()).toBe(false);
    expect(checks.database).toMatchObject({ ok: true, skipped: true, code: 'FIXTURE_DATA_MODE' });
    expect(checks.storage).toMatchObject({ ok: true, skipped: true, code: 'FIXTURE_DATA_MODE' });
    expect(fake.calls).toEqual([]);
  });

  it('probes as soon as service credentials exist, even outside production', async () => {
    process.env.NODE_ENV = 'development';
    process.env.SUPABASE_URL = 'https://fake.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const checks = await probes.dataPathChecks();

    expect(probes.dataProbesRequired()).toBe(true);
    expect(checks.database.ok).toBe(true);
    expect(checks.storage.ok).toBe(true);
  });
});
