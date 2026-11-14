import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asSuper, createDb } from './helpers/pg';

/**
 * Migration 0011 — hosted object buckets for profile and story media.
 *
 * These are public-read buckets written only by the service role; no direct
 * client upload policy is created for them.
 */
let db: PGlite;

beforeAll(async () => {
  db = await createDb();
  await asSuper(db);
});

afterAll(async () => {
  await db?.close();
});

describe('0011 profile/story media buckets', () => {
  it('creates public profile and story buckets', async () => {
    const { rows } = await db.query<{ id: string; public: boolean }>(
      `select id, public from storage.buckets
       where id in ('profile-media', 'story-media')
       order by id`,
    );
    expect(rows).toEqual([
      { id: 'profile-media', public: true },
      { id: 'story-media', public: true },
    ]);
  });

  it('adds public read policies but no direct write policy', async () => {
    const { rows } = await db.query<{ policyname: string; cmd: string }>(
      `select policyname, cmd from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and (policyname like '%profile media%' or policyname like '%story media%')
       order by policyname`,
    );
    expect(rows).toEqual([
      { policyname: 'public read profile media', cmd: 'SELECT' },
      { policyname: 'public read story media', cmd: 'SELECT' },
    ]);
  });

  it('stores profile and story object paths in the new buckets', async () => {
    await db.query(
      `insert into storage.objects (bucket_id, name) values
         ('profile-media', 'user/avatar.webp'),
         ('story-media', 'user/story.webp')`,
    );
    const { rows } = await db.query<{ bucket_id: string; name: string }>(
      `select bucket_id, name from storage.objects
       where bucket_id in ('profile-media', 'story-media')
       order by bucket_id`,
    );
    expect(rows).toEqual([
      { bucket_id: 'profile-media', name: 'user/avatar.webp' },
      { bucket_id: 'story-media', name: 'user/story.webp' },
    ]);
  });
});
