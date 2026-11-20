#!/usr/bin/env node
/**
 * Release preflight: prove the deployed Supabase project has this code's
 * schema and buckets before the app that needs them goes live.
 *
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   npm run preflight
 *
 *   npm run preflight -- --url=https://<project>.supabase.co --json
 *
 * What it asserts:
 *   1. the project URL and service-role key are present;
 *   2. every table, view, column and RPC in `scripts/preflight-manifest.mjs`
 *      is exposed by PostgREST (an unapplied migration is a hard failure, not a
 *      feature that "quietly does nothing" in production);
 *   3. every storage bucket exists with the expected public/private flag.
 *
 * The manifest is kept in sync with `supabase/migrations/*.sql` by
 * `tests/preflight-manifest.test.ts`, so a new migration cannot be released
 * without a check. Exit code 0 = safe to release, 1 = fix the project first.
 * Read-only: it never writes a row or an object.
 */
import { BUCKETS, COLUMNS, MIGRATION_FILES, RPCS, TABLES, VIEWS } from './preflight-manifest.mjs';

const REQUEST_TIMEOUT_MS = 15_000;

function arg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

const jsonOutput = process.argv.includes('--json');

function projectUrl() {
  const explicit = arg('url');
  const raw = explicit ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  return raw ? raw.replace(/\/+$/, '') : '';
}

async function get(path, headers = {}) {
  const response = await fetch(path, {
    headers: { apikey: headers.apikey ?? '', ...headers },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return response;
}

function describe(error) {
  if (error?.name === 'TimeoutError') return `no answer within ${REQUEST_TIMEOUT_MS}ms`;
  return error?.message ?? String(error);
}

async function main() {
  const url = projectUrl();
  const key = arg('key') ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const checks = [];

  const record = (group, label, ok, detail) => {
    checks.push({ group, label, ok, detail });
  };

  if (!url) {
    record('config', 'SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL', false, 'not set');
  } else {
    record('config', 'SUPABASE_URL', true, url);
  }
  if (!key) {
    record(
      'config',
      'SUPABASE_SERVICE_ROLE_KEY',
      false,
      'not set — the schema probe and bucket listing need the service role',
    );
  } else {
    record('config', 'SUPABASE_SERVICE_ROLE_KEY', true, 'set');
  }

  if (url && key) {
    // ── Schema: one OpenAPI read covers tables, views, columns and RPCs. ─────
    let spec = null;
    let specError = null;
    try {
      const response = await get(`${url}/rest/v1/`, {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/openapi+json',
      });
      if (!response.ok) {
        specError = `HTTP ${response.status} ${response.statusText}`;
      } else {
        spec = await response.json();
      }
    } catch (error) {
      specError = describe(error);
    }

    if (!spec) {
      record(
        'migrations',
        'PostgREST schema',
        false,
        `could not read ${url}/rest/v1/ (${specError}). Is the project reachable and are the keys for this project?`,
      );
    } else {
      const definitions = spec.definitions ?? {};
      const paths = spec.paths ?? {};
      const tableNames = new Set(Object.keys(definitions));
      const rpcNames = new Set(
        Object.keys(paths)
          .filter((path) => path.startsWith('/rpc/'))
          .map((path) => path.slice('/rpc/'.length)),
      );

      for (const table of TABLES) {
        record(
          'migrations',
          `table public.${table.name}`,
          tableNames.has(table.name),
          `created by ${table.migration}`,
        );
      }
      for (const view of VIEWS) {
        record(
          'migrations',
          `view public.${view.name}`,
          tableNames.has(view.name),
          `defined by ${view.migration}`,
        );
      }
      for (const { table, column, migration } of COLUMNS) {
        const properties = definitions[table]?.properties ?? {};
        record(
          'migrations',
          `column ${table}.${column}`,
          Object.prototype.hasOwnProperty.call(properties, column),
          `added by ${migration}`,
        );
      }
      for (const rpc of RPCS) {
        record(
          'migrations',
          `rpc ${rpc.name}()`,
          rpcNames.has(rpc.name),
          `created by ${rpc.migration}`,
        );
      }
    }

    // ── Storage buckets. ────────────────────────────────────────────────────
    let buckets = null;
    let bucketError = null;
    try {
      const response = await get(`${url}/storage/v1/bucket`, {
        apikey: key,
        Authorization: `Bearer ${key}`,
      });
      if (!response.ok) {
        bucketError = `HTTP ${response.status} ${response.statusText}`;
      } else {
        buckets = await response.json();
      }
    } catch (error) {
      bucketError = describe(error);
    }

    if (!Array.isArray(buckets)) {
      record(
        'buckets',
        'storage bucket list',
        false,
        `could not list buckets (${bucketError}). Check the service-role key and the Storage API.`,
      );
    } else {
      const byId = new Map(buckets.map((bucket) => [bucket.id ?? bucket.name, bucket]));
      for (const bucket of BUCKETS) {
        const found = byId.get(bucket.id);
        if (!found) {
          record('buckets', `bucket ${bucket.id}`, false, `missing (${bucket.migration})`);
          continue;
        }
        const isPublic = Boolean(found.public);
        record(
          'buckets',
          `bucket ${bucket.id}`,
          isPublic === bucket.public,
          isPublic === bucket.public
            ? `${bucket.public ? 'public' : 'private'} as expected`
            : `is ${isPublic ? 'public' : 'private'}, expected ${bucket.public ? 'public' : 'private'} (${bucket.migration})`,
        );
      }
    }
  }

  const failed = checks.filter((check) => !check.ok);
  const migrationsApplied = checks.filter((check) => check.group === 'migrations' && check.ok).length;

  if (jsonOutput) {
    console.log(JSON.stringify({ ok: failed.length === 0, url, checks }, null, 2));
  } else {
    console.log(`[preflight] project: ${url || '(missing)'}`);
    console.log(
      `[preflight] manifest: ${MIGRATION_FILES.length} migrations, ${TABLES.length} tables, ${VIEWS.length} views, ${RPCS.length} RPCs, ${BUCKETS.length} buckets`,
    );
    let group = null;
    for (const check of checks) {
      if (check.group !== group) {
        group = check.group;
        console.log(`\n${group}`);
      }
      console.log(`  ${check.ok ? '✓' : '✗'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
    }
    console.log('');
    if (failed.length === 0) {
      console.log(
        `[preflight] OK — ${checks.length} checks passed (${migrationsApplied} schema objects verified).`,
      );
    } else {
      console.log(`[preflight] FAILED — ${failed.length} of ${checks.length} checks failed:`);
      for (const check of failed) console.log(`  - ${check.label}: ${check.detail ?? 'failed'}`);
      console.log('');
      console.log('[preflight] Fix before releasing:');
      console.log('  1. link Supabase CLI to the project and apply migrations:');
      console.log('       supabase link --project-ref <ref>');
      console.log('       supabase db push');
      console.log('  2. create any missing buckets (see supabase/migrations/0004_storage.sql');
      console.log('     and 0011_profile_story_media.sql, or DEPLOY_RUNBOOK.md).');
      console.log('  3. re-run this preflight, then deploy the app.');
    }
  }

  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error('[preflight] crashed:', error);
  process.exitCode = 1;
});
