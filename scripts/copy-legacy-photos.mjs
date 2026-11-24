#!/usr/bin/env node
/**
 * Copy every object from the legacy `listing-photos` bucket into `photos`.
 *
 * 0019 records the bucket with each photo row and backfills pre-existing rows to
 * `listing-photos`. If that backfill ever mislabels a row — or an object was
 * uploaded to the new bucket while its row kept the old one — the row's URL
 * points at a bucket that has no such file. Copying the legacy objects into
 * `photos` makes every stored path resolvable in both buckets, whatever the row
 * says; it never rewrites the database and never deletes the source objects.
 *
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/copy-legacy-photos.mjs              # dry run: what would copy
 *
 *   node scripts/copy-legacy-photos.mjs --apply      # actually copy
 *
 * Idempotent: the destination is listed first and existing paths are skipped, a
 * concurrent duplicate (409) is treated as skipped, and nothing is ever
 * overwritten (`x-upsert: false`). Re-running after a partial run copies only
 * what is still missing. Byte-for-byte; the source object's content type is
 * preserved (WebP unless Storage reports otherwise).
 *
 * Service role only: the script reads private objects and writes the bucket, so
 * it needs SUPABASE_SERVICE_ROLE_KEY and must run from a trusted machine. It is
 * never called by the app.
 *
 * Options: --apply, --from=<bucket>, --to=<bucket>, --url=<project>,
 * --key=<service-role-key>, --quiet.
 */

const PAGE_SIZE = 1000;
const REQUEST_TIMEOUT_MS = 60_000;

function arg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function trimUrl(value) {
  return value ? value.replace(/\/+$/, '') : '';
}

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * Copy `from` into `to`. Exported so a test can drive it with a fake `fetch`
 * and prove the skip-existing/idempotency rules without a project.
 *
 * @param {object} options
 * @param {string} options.url              Project URL, e.g. https://x.supabase.co
 * @param {string} options.serviceKey       Service-role key (never logged).
 * @param {string} [options.from]           Source bucket (default listing-photos).
 * @param {string} [options.to]             Destination bucket (default photos).
 * @param {boolean} [options.apply]         Write when true; dry run otherwise.
 * @param {typeof fetch} [options.fetchImpl]
 * @param {(line: string) => void} [options.log]
 */
export async function copyLegacyPhotos({
  url,
  serviceKey,
  from = 'listing-photos',
  to = 'photos',
  apply = false,
  fetchImpl = fetch,
  log = (line) => console.log(line),
}) {
  const base = trimUrl(url);
  if (!base) throw new Error('SUPABASE_URL (or --url=) is required');
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY (or --key=) is required');
  if (from === to) throw new Error(`source and destination are the same bucket «${from}»`);

  const authHeaders = { apikey: serviceKey, authorization: `Bearer ${serviceKey}` };

  async function request(path, init = {}) {
    const response = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: { ...authHeaders, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return response;
  }

  async function listPage(bucket, prefix, offset) {
    const response = await request(`/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prefix,
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });
    if (!response.ok) {
      throw new Error(
        `listing «${bucket}»${prefix ? ` /${prefix}` : ''} failed: HTTP ${response.status}`,
      );
    }
    const entries = await response.json();
    return Array.isArray(entries) ? entries : [];
  }

  /** Every object path in a bucket, folders expanded, placeholders dropped. */
  async function listAll(bucket, prefix = '') {
    const objects = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await listPage(bucket, prefix, offset);
      for (const entry of page) {
        const name = String(entry.name ?? '');
        if (!name || name === '.emptyFolderPlaceholder') continue;
        const path = prefix ? `${prefix}/${name}` : name;
        // Storage lists folders as entries without an id/metadata.
        if (entry.id == null || entry.metadata == null) {
          objects.push(...(await listAll(bucket, path)));
        } else {
          objects.push({
            path,
            mime: typeof entry.metadata.mimetype === 'string' ? entry.metadata.mimetype : null,
          });
        }
      }
      if (page.length < PAGE_SIZE) break;
    }
    return objects;
  }

  log(`[copy-legacy-photos] project: ${base}`);
  log(`[copy-legacy-photos] ${from} → ${to}${apply ? '' : ' (dry run)'}`);

  const source = await listAll(from);
  const existing = new Set((await listAll(to)).map((object) => object.path));
  log(`[copy-legacy-photos] ${source.length} object(s) in «${from}», ${existing.size} in «${to}»`);

  const summary = { listed: source.length, alreadyPresent: 0, copied: 0, wouldCopy: 0, failed: [] };

  for (const object of [...source].sort((a, b) => a.path.localeCompare(b.path))) {
    if (existing.has(object.path)) {
      summary.alreadyPresent += 1;
      continue;
    }
    if (!apply) {
      summary.wouldCopy += 1;
      log(`  would copy  ${object.path}`);
      continue;
    }

    try {
      const download = await request(`/storage/v1/object/${from}/${encodePath(object.path)}`);
      if (!download.ok) {
        throw new Error(`download failed: HTTP ${download.status}`);
      }
      const bytes = await download.arrayBuffer();
      const mime = object.mime ?? download.headers.get('content-type') ?? 'image/webp';

      const upload = await request(`/storage/v1/object/${to}/${encodePath(object.path)}`, {
        method: 'POST',
        headers: {
          'content-type': mime,
          'cache-control': 'public, max-age=31536000, immutable',
          // Never overwrite: a half-run script must not clobber a newer object.
          'x-upsert': 'false',
        },
        body: bytes,
      });

      if (upload.ok) {
        summary.copied += 1;
        log(`  copied      ${object.path} (${bytes.byteLength} bytes)`);
        continue;
      }

      // The bucket is listed up front, so a 409 means another run won the race.
      const detail = await upload.text().catch(() => '');
      if (upload.status === 409 || /already exists|duplicate/i.test(detail)) {
        summary.alreadyPresent += 1;
        log(`  exists      ${object.path}`);
        continue;
      }
      throw new Error(`upload failed: HTTP ${upload.status} ${detail.slice(0, 200)}`.trim());
    } catch (error) {
      summary.failed.push({ path: object.path, message: error?.message ?? String(error) });
      log(`  FAILED      ${object.path} — ${error?.message ?? error}`);
    }
  }

  const target = apply ? summary.copied : summary.wouldCopy;
  log(
    `[copy-legacy-photos] ${summary.alreadyPresent} already present, ${target} ${
      apply ? 'copied' : 'to copy'
    }, ${summary.failed.length} failed`,
  );
  if (!apply && summary.wouldCopy > 0) {
    log('[copy-legacy-photos] dry run only — re-run with --apply to write.');
  }
  return summary;
}

async function main() {
  const url = trimUrl(
    arg('url') ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  );
  const serviceKey = arg('key') ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const from = arg('from') ?? 'listing-photos';
  const to = arg('to') ?? 'photos';
  const apply = process.argv.includes('--apply');
  const quiet = process.argv.includes('--quiet');

  if (!url || !serviceKey) {
    console.error(
      '[copy-legacy-photos] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or --url= / --key=).',
    );
    process.exit(1);
  }

  try {
    const summary = await copyLegacyPhotos({
      url,
      serviceKey,
      from,
      to,
      apply,
      log: quiet ? () => {} : undefined,
    });
    process.exit(summary.failed.length === 0 ? 0 : 1);
  } catch (error) {
    console.error(`[copy-legacy-photos] ${error?.message ?? error}`);
    process.exit(1);
  }
}

// Run only when executed directly (`node scripts/copy-legacy-photos.mjs`); the
// test imports the function and supplies its own fetch.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
