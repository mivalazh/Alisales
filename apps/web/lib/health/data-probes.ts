import { hostedDataConfigured, requireHostedServices, serverSupabaseUrl } from '../config/mode';
import { PHOTO_BUCKET } from '../data/photo-rules';
import { admin } from '../data/s2-store';

/**
 * Health-check probes for the production data path.
 *
 * Configuration presence is not readiness: a service-role key that is missing,
 * revoked or pointing at a project where the migration was never applied only
 * shows up later as listings and photos that quietly fail to save. These two
 * probes therefore exercise the real path with the real credentials:
 *
 *  - `database` inserts one throwaway row into `health_probes`, reads it back
 *    by id, compares the token and deletes it;
 *  - `storage` uploads one tiny object into the `photos` bucket,
 *    downloads it, compares the bytes and removes it.
 *
 * Each probe reports its own check, and every step is bounded so a hung
 * project cannot stall the endpoint. Nothing secret is returned — only codes,
 * resource names and short messages.
 */

export interface DataPathCheck {
  ok: boolean;
  /** True when the deployment intentionally runs on the fixture store. */
  skipped?: boolean;
  code?: string;
  message?: string;
  table?: string;
  bucket?: string;
  roundTripMs?: number;
}

/** Table `0013_health_probes.sql` creates; each probe row is deleted again. */
export const PROBE_TABLE = 'health_probes';
/** Object prefix inside the listing bucket; each probe object is removed. */
export const PROBE_OBJECT_PREFIX = 'health-probe';
const PROBE_TIMEOUT_MS = 4_000;

class ProbeTimeoutError extends Error {
  constructor(step: string) {
    super(`the ${step} step did not answer within ${PROBE_TIMEOUT_MS}ms`);
    this.name = 'ProbeTimeoutError';
  }
}

async function withTimeout<T>(work: Promise<T>, step: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProbeTimeoutError(step)), PROBE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Probe the hosted path in production, and anywhere an operator asked for
 * hosted services or already configured service credentials. A fixture-mode
 * development build has no production path to prove and reports `skipped`.
 */
export function dataProbesRequired(): boolean {
  return requireHostedServices() || hostedDataConfigured();
}

function missingSupabaseConfig(): DataPathCheck | null {
  if (!serverSupabaseUrl()) {
    return {
      ok: false,
      code: 'SUPABASE_URL_MISSING',
      message:
        'SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL is not set, so the hosted data path cannot be exercised.',
    };
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      ok: false,
      code: 'SUPABASE_SERVICE_ROLE_KEY_MISSING',
      message:
        'SUPABASE_SERVICE_ROLE_KEY is missing; server writes cannot reach Supabase and listings or media would silently fail to persist.',
    };
  }
  return null;
}

/** Defensive: credentials read fine but the client could not be built. */
function unreachableConfig(resource: string): DataPathCheck {
  return {
    ok: false,
    table: resource === PROBE_TABLE ? PROBE_TABLE : undefined,
    bucket: resource === PROBE_TABLE ? undefined : resource,
    code: 'SUPABASE_CONFIG_UNUSABLE',
    message: 'Supabase credentials are set but the probe client could not be created.',
  };
}

function errorText(error: unknown): string {
  if (!error) return 'no error detail';
  if (typeof error === 'string') return error;
  const candidate = error as { message?: unknown; code?: unknown; statusCode?: unknown };
  const message = typeof candidate.message === 'string' ? candidate.message : String(error);
  const status = candidate.statusCode ?? candidate.code;
  return status ? `${message} (${String(status)})` : message;
}

function timedOut(error: unknown): boolean {
  return error instanceof ProbeTimeoutError;
}

function databaseCode(error: unknown): string {
  const text = errorText(error);
  if (timedOut(error)) return 'SUPABASE_TIMEOUT';
  if (/could not find the table|does not exist|schema cache|42P01/i.test(text)) {
    return 'SUPABASE_TABLE_MISSING';
  }
  if (/permission denied|row-level security|42501/i.test(text)) return 'SUPABASE_PERMISSION_DENIED';
  if (/invalid api key|invalid jwt|jwt expired|\b401\b|\b403\b/i.test(text)) {
    return 'SUPABASE_SERVICE_ROLE_KEY_REJECTED';
  }
  return 'SUPABASE_WRITE_FAILED';
}

function databaseMessage(code: string): string {
  switch (code) {
    case 'SUPABASE_TIMEOUT':
      return 'The database probe timed out; Supabase did not answer the health round trip.';
    case 'SUPABASE_TABLE_MISSING':
      return `Table public.${PROBE_TABLE} is missing or not in the PostgREST schema cache; apply supabase/migrations/0013_health_probes.sql.`;
    case 'SUPABASE_PERMISSION_DENIED':
      return `The service role cannot write public.${PROBE_TABLE}; check the grants in 0013_health_probes.sql.`;
    case 'SUPABASE_SERVICE_ROLE_KEY_REJECTED':
      return 'Supabase rejected the service-role key; server writes to the database are disabled.';
    default:
      return `Writing or reading back a ${PROBE_TABLE} row failed; see the server log for the provider message.`;
  }
}

function storageCode(error: unknown): string {
  const text = errorText(error);
  if (timedOut(error)) return 'STORAGE_TIMEOUT';
  if (/bucket not found|bucket.*does not exist|\b404\b/i.test(text)) return 'STORAGE_BUCKET_MISSING';
  if (/invalid api key|invalid jwt|jwt expired|\b401\b|\b403\b/i.test(text)) {
    return 'SUPABASE_SERVICE_ROLE_KEY_REJECTED';
  }
  return 'STORAGE_ROUND_TRIP_FAILED';
}

function storageMessage(code: string): string {
  switch (code) {
    case 'STORAGE_TIMEOUT':
      return 'The storage probe timed out; Supabase storage did not answer the health round trip.';
    case 'STORAGE_BUCKET_MISSING':
      return `Bucket ${PHOTO_BUCKET} is missing; listing photos cannot be uploaded. Apply supabase/migrations/0004_storage.sql.`;
    case 'SUPABASE_SERVICE_ROLE_KEY_REJECTED':
      return 'Supabase storage rejected the service-role key; media uploads are disabled.';
    default:
      return `Uploading, downloading or deleting a probe object in ${PHOTO_BUCKET} failed; see the server log for the provider message.`;
  }
}

/**
 * Write → read back → delete one row with the service role.
 *
 * The row carries a fresh token; the read compares it, so a stale schema cache
 * or a trigger that rewrites the row is caught instead of assumed healthy.
 */
export async function probeDatabase(): Promise<DataPathCheck> {
  const missing = missingSupabaseConfig();
  if (missing) return { ...missing, table: PROBE_TABLE };
  const sb = admin();
  if (!sb) return unreachableConfig(PROBE_TABLE);

  const token = crypto.randomUUID();
  const started = Date.now();
  let rowId: string | null = null;

  try {
    const inserted = await withTimeout(
      Promise.resolve(
        sb.from(PROBE_TABLE).insert({ note: token }).select('id, note').single(),
      ),
      'write',
    );
    if (inserted.error) throw inserted.error;
    const row = inserted.data as { id?: unknown; note?: unknown } | null;
    if (!row || typeof row.id !== 'string') {
      return {
        ok: false,
        table: PROBE_TABLE,
        code: 'SUPABASE_WRITE_FAILED',
        message: `Inserting into public.${PROBE_TABLE} returned no row.`,
      };
    }
    rowId = row.id;

    const readBack = await withTimeout(
      Promise.resolve(
        sb.from(PROBE_TABLE).select('id, note').eq('id', rowId).maybeSingle(),
      ),
      'read back',
    );
    if (readBack.error) throw readBack.error;
    const found = readBack.data as { note?: unknown } | null;
    if (!found || found.note !== token) {
      return {
        ok: false,
        table: PROBE_TABLE,
        code: 'SUPABASE_READ_MISMATCH',
        message: `A ${PROBE_TABLE} row was written but the same row did not read back with the probe token.`,
      };
    }

    const removed = await withTimeout(
      Promise.resolve(sb.from(PROBE_TABLE).delete().eq('id', rowId)),
      'delete',
    );
    if (removed.error) throw removed.error;
    rowId = null;

    return { ok: true, table: PROBE_TABLE, roundTripMs: Date.now() - started };
  } catch (error) {
    const code = databaseCode(error);
    console.warn(`[alisales:health] database probe failed (${code}):`, errorText(error));
    return { ok: false, table: PROBE_TABLE, code, message: databaseMessage(code) };
  } finally {
    if (rowId) {
      // Best effort: an orphaned probe row must never break the application,
      // but it also must not survive unnoticed in a real deployment.
      await Promise.resolve(sb.from(PROBE_TABLE).delete().eq('id', rowId)).catch(() => undefined);
    }
  }
}

/**
 * Upload → download → delete one small object in the listing bucket.
 *
 * `PHOTO_BUCKET` is the bucket listings actually depend on, so a missing or
 * read-only bucket fails here instead of as a cover that never loads.
 */
export async function probeStorage(): Promise<DataPathCheck> {
  const missing = missingSupabaseConfig();
  if (missing) return { ...missing, bucket: PHOTO_BUCKET };
  const sb = admin();
  if (!sb) return unreachableConfig(PHOTO_BUCKET);

  const token = `alisales-health-${crypto.randomUUID()}`;
  const path = `${PROBE_OBJECT_PREFIX}/${crypto.randomUUID()}.txt`;
  const bucket = sb.storage.from(PHOTO_BUCKET);
  const started = Date.now();
  let uploaded = false;

  try {
    const upload = await withTimeout(
      Promise.resolve(
        bucket.upload(path, new TextEncoder().encode(token), {
          contentType: 'text/plain',
          upsert: false,
        }),
      ),
      'upload',
    );
    if (upload.error) throw upload.error;
    uploaded = true;

    const download = await withTimeout(Promise.resolve(bucket.download(path)), 'download');
    if (download.error) throw download.error;
    const body = await download.data.text();
    if (body.trim() !== token) {
      return {
        ok: false,
        bucket: PHOTO_BUCKET,
        code: 'STORAGE_READ_MISMATCH',
        message: `An object in ${PHOTO_BUCKET} was uploaded but downloaded with different bytes.`,
      };
    }

    const removed = await withTimeout(Promise.resolve(bucket.remove([path])), 'delete');
    if (removed.error) throw removed.error;
    uploaded = false;

    return { ok: true, bucket: PHOTO_BUCKET, roundTripMs: Date.now() - started };
  } catch (error) {
    const code = storageCode(error);
    console.warn(`[alisales:health] storage probe failed (${code}):`, errorText(error));
    return { ok: false, bucket: PHOTO_BUCKET, code, message: storageMessage(code) };
  } finally {
    if (uploaded) {
      await Promise.resolve(bucket.remove([path])).catch(() => undefined);
    }
  }
}

/** Both data-path checks, as separate entries in the health body. */
export async function dataPathChecks(): Promise<{
  database: DataPathCheck;
  storage: DataPathCheck;
}> {
  if (!dataProbesRequired()) {
    const skipped: DataPathCheck = {
      ok: true,
      skipped: true,
      code: 'FIXTURE_DATA_MODE',
      message:
        'No hosted data path is configured, so this development deployment reads and writes the local fixture store.',
    };
    return {
      database: { ...skipped, table: PROBE_TABLE },
      storage: { ...skipped, bucket: PHOTO_BUCKET },
    };
  }

  const [database, storage] = await Promise.all([probeDatabase(), probeStorage()]);
  return { database, storage };
}
