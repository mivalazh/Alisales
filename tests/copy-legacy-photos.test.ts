import { describe, expect, it } from 'vitest';
import { copyLegacyPhotos } from '../scripts/copy-legacy-photos.mjs';

/**
 * The safety net for 0019: objects that live only in `listing-photos` are
 * copied into `photos`, so a row mislabelled after the backfill still resolves.
 * Nothing here touches a project — a fake Storage API proves the rules that
 * matter: only missing objects are copied, bytes are preserved, and a re-run
 * writes nothing.
 */

const PROJECT = 'https://x.supabase.co';
const KEY = 'service-key';

interface FakeBucket {
  [path: string]: string;
}

/** A minimal Storage API: list (with folders), download, upload. */
function fakeStorage(buckets: Record<string, FakeBucket>) {
  const uploads: Array<{ bucket: string; path: string; body: string; upsert: string | null }> = [];
  const requests: string[] = [];

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const segments = url.pathname.split('/').filter(Boolean);
    // /storage/v1/object/list/{bucket}
    if (url.pathname.startsWith('/storage/v1/object/list/')) {
      const bucket = segments[4] ?? '';
      const body = JSON.parse(String(init?.body ?? '{}')) as { prefix?: string };
      const prefix = body.prefix ?? '';
      requests.push(`list ${bucket} ${prefix}`);
      const names = new Set<string>();
      for (const path of Object.keys(buckets[bucket] ?? {})) {
        if (!path.startsWith(prefix ? `${prefix}/` : '')) continue;
        const rest = prefix ? path.slice(prefix.length + 1) : path;
        names.add(rest.split('/')[0]!);
      }
      const entries = [...names].sort().map((name) => {
        const full = prefix ? `${prefix}/${name}` : name;
        // No id/metadata → the API's representation of a folder.
        return buckets[bucket]?.[full] === undefined
          ? { name, id: null, metadata: null }
          : { name, id: full, metadata: { mimetype: 'image/webp', size: buckets[bucket]![full]!.length } };
      });
      return new Response(JSON.stringify(entries), { status: 200 });
    }

    const bucket = segments[3] ?? '';
    const path = decodeURIComponent(segments.slice(4).join('/'));
    requests.push(`${init?.method ?? 'GET'} ${bucket} ${path}`);
    const uploadedBody = (body: BodyInit | null | undefined): string =>
      body instanceof ArrayBuffer
        ? Buffer.from(body).toString('utf8')
        : typeof body === 'string'
          ? body
          : '';

    if (init?.method === 'POST') {
      const current = buckets[bucket] ?? {};
      if (current[path] !== undefined) {
        return new Response(JSON.stringify({ statusCode: '409', error: 'Duplicate' }), {
          status: 409,
        });
      }
      uploads.push({
        bucket,
        path,
        body: uploadedBody(init.body),
        upsert: new Headers(init.headers).get('x-upsert'),
      });
      current[path] = uploadedBody(init.body);
      buckets[bucket] = current;
      return new Response(JSON.stringify({ Key: `${bucket}/${path}` }), { status: 200 });
    }

    const bytes = buckets[bucket]?.[path];
    if (bytes === undefined) return new Response('not found', { status: 404 });
    return new Response(bytes, { status: 200, headers: { 'content-type': 'image/webp' } });
  }) as typeof fetch;

  return { fetchImpl, uploads, requests };
}

const buckets = () => ({
  'listing-photos': {
    'shared.webp': 'shared-bytes',
    'seller/legacy.webp': 'legacy-bytes',
    'seller/already.webp': 'already-bytes',
  },
  photos: {
    'seller/already.webp': 'already-bytes',
  },
});

describe('copy-legacy-photos', () => {
  it('copies only the objects the photos bucket is missing', async () => {
    const storage = fakeStorage(buckets());
    const summary = await copyLegacyPhotos({
      url: PROJECT,
      serviceKey: KEY,
      apply: true,
      fetchImpl: storage.fetchImpl,
      log: () => {},
    });

    expect(summary).toMatchObject({ listed: 3, alreadyPresent: 1, copied: 2, failed: [] });
    expect(storage.uploads.map((u) => `${u.bucket}/${u.path}`).sort()).toEqual([
      'photos/seller/legacy.webp',
      'photos/shared.webp',
    ]);
    // Bytes and the no-overwrite contract survive the copy.
    expect(storage.uploads.every((u) => u.upsert === 'false')).toBe(true);
    expect(storage.uploads.find((u) => u.path === 'shared.webp')?.body).toBe('shared-bytes');
  });

  it('is idempotent: a second run writes nothing', async () => {
    const data = buckets();
    const storage = fakeStorage(data);
    await copyLegacyPhotos({
      url: PROJECT,
      serviceKey: KEY,
      apply: true,
      fetchImpl: storage.fetchImpl,
      log: () => {},
    });
    const second = fakeStorage(data);

    const summary = await copyLegacyPhotos({
      url: PROJECT,
      serviceKey: KEY,
      apply: true,
      fetchImpl: second.fetchImpl,
      log: () => {},
    });

    expect(summary).toMatchObject({ alreadyPresent: 3, copied: 0, failed: [] });
    expect(second.uploads).toEqual([]);
    expect(Object.keys(data.photos).sort()).toEqual([
      'seller/already.webp',
      'seller/legacy.webp',
      'shared.webp',
    ]);
  });

  it('writes nothing without --apply, but reports what it would copy', async () => {
    const storage = fakeStorage(buckets());
    const lines: string[] = [];
    const summary = await copyLegacyPhotos({
      url: PROJECT,
      serviceKey: KEY,
      fetchImpl: storage.fetchImpl,
      log: (line) => lines.push(line),
    });

    expect(summary).toMatchObject({ wouldCopy: 2, copied: 0, failed: [] });
    expect(storage.uploads).toEqual([]);
    expect(lines.some((line) => line.includes('would copy  shared.webp'))).toBe(true);
    expect(lines.some((line) => line.includes('--apply'))).toBe(true);
  });

  it('treats a concurrent duplicate (409) as already present, not a failure', async () => {
    const data = buckets();
    delete data.photos['seller/already.webp'];
    const base = fakeStorage(data);
    const racing = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      );
      // The destination listing saw nothing, so the script tries the upload …
      if (url.pathname === '/storage/v1/object/list/photos') {
        return new Response('[]', { status: 200 });
      }
      // … and another run creates the same object first.
      if (init?.method === 'POST' && url.pathname.endsWith('/photos/shared.webp')) {
        return new Response(JSON.stringify({ statusCode: '409', error: 'Duplicate' }), {
          status: 409,
        });
      }
      return base.fetchImpl(input, init);
    }) as typeof fetch;

    const summary = await copyLegacyPhotos({
      url: PROJECT,
      serviceKey: KEY,
      apply: true,
      fetchImpl: racing,
      log: () => {},
    });

    expect(summary).toMatchObject({ alreadyPresent: 1, copied: 2, failed: [] });
  });

  it('refuses to copy a bucket onto itself', async () => {
    await expect(
      copyLegacyPhotos({
        url: PROJECT,
        serviceKey: KEY,
        from: 'photos',
        to: 'photos',
        fetchImpl: fakeStorage(buckets()).fetchImpl,
        log: () => {},
      }),
    ).rejects.toThrow(/same bucket/);
  });
});
