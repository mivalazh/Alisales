import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  IDS,
  LISTINGS,
  asAnonymous,
  asSuper,
  asUser,
  createDb,
  expectError,
} from './helpers/pg';

/**
 * Migration 0006 — account favorites + owner-only statistics storage.
 * Rules under test: unique view per (listing, viewer); phone reveals counted
 * per event; favorites are per account and unique; reads restricted to the
 * owner; guests and other users see nothing; clients cannot write events.
 */
let db: PGlite;
let ownerId: string;
let listingId: string;
let otherUserId: string;
let thirdUserId: string;

beforeAll(async () => {
  db = await createDb();
  listingId = LISTINGS.alice206;

  await asSuper(db);
  const owner = await db.query<{ created_by: string }>(
    `select created_by from public.listings where id = $1`,
    [listingId],
  );
  ownerId = owner.rows[0]!.created_by;

  const candidates = [IDS.bob, IDS.carol, IDS.dave].filter((id) => id !== ownerId);
  otherUserId = candidates[0]!;
  thirdUserId = candidates[1]!;
});

afterAll(async () => {
  await db?.close();
});

describe('0006 storage shape', () => {
  it('creates the statistics tables with row level security enabled', async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
       where relname in ('listing_views', 'phone_reveal_events')
       order by relname`,
    );
    expect(r.rows).toHaveLength(2);
    for (const row of r.rows) expect(row.relrowsecurity).toBe(true);
  });

  it('creates account favorites with RLS enabled', async () => {
    const r = await db.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class where relname = 'listing_favorites'`,
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.relrowsecurity).toBe(true);
  });

  it('accepts one view per viewer and rejects a duplicate', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.listing_views (listing_id, viewer_id) values ($1, $2)`,
      [listingId, otherUserId],
    );
    await expectError(
      db.query(`insert into public.listing_views (listing_id, viewer_id) values ($1, $2)`, [
        listingId,
        otherUserId,
      ]),
      'duplicate key',
    );
  });
});

describe('listing_favorites', () => {
  it('lets a user save a listing once and rejects a duplicate', async () => {
    await asUser(db, otherUserId);
    await db.query(
      `insert into public.listing_favorites (listing_id, user_id) values ($1, $2)`,
      [listingId, otherUserId],
    );
    await expectError(
      db.query(`insert into public.listing_favorites (listing_id, user_id) values ($1, $2)`, [
        listingId,
        otherUserId,
      ]),
      'duplicate key',
    );
  });

  it('shows a user only their own favorite rows', async () => {
    await asUser(db, otherUserId);
    const own = await db.query<{ user_id: string }>(
      `select user_id from public.listing_favorites`,
    );
    expect(own.rows).toHaveLength(1);
    expect(own.rows[0]!.user_id).toBe(otherUserId);

    await asUser(db, thirdUserId);
    const foreign = await db.query(`select id from public.listing_favorites`);
    expect(foreign.rows).toHaveLength(0);
  });

  it('refuses to save a listing on another account', async () => {
    await asUser(db, thirdUserId);
    await expectError(
      db.query(`insert into public.listing_favorites (listing_id, user_id) values ($1, $2)`, [
        listingId,
        otherUserId,
      ]),
      'row-level security',
    );
  });

  it('gives the owner aggregate counts only, never the saver rows', async () => {
    await asUser(db, thirdUserId);
    await db.query(
      `insert into public.listing_favorites (listing_id, user_id) values ($1, $2)`,
      [listingId, thirdUserId],
    );

    await asUser(db, ownerId);
    const counts = await db.query<{ listing_id: string; favorite_count: number }>(
      `select listing_id, favorite_count from public.listing_favorite_counts()`,
    );
    expect(counts.rows).toEqual([{ listing_id: listingId, favorite_count: 2 }]);

    // The raw rows stay invisible to the owner: RLS is own-rows only.
    const rows = await db.query(`select id from public.listing_favorites`);
    expect(rows.rows).toHaveLength(0);
  });

  it('hides counts from other users entirely', async () => {
    await asUser(db, otherUserId);
    const counts = await db.query<{ listing_id: string }>(
      `select listing_id from public.listing_favorite_counts()`,
    );
    expect(counts.rows.some((r) => r.listing_id === listingId)).toBe(false);
  });

  it('shows guests nothing and forbids writes', async () => {
    await asAnonymous(db);
    await expectError(db.query(`select id from public.listing_favorites`), 'permission denied');
    await expectError(db.query(`select * from public.listing_favorite_counts()`), 'permission denied');
  });

  it('lets a user remove their own favorite, updating the owner count', async () => {
    await asUser(db, thirdUserId);
    await db.query(
      `delete from public.listing_favorites where listing_id = $1 and user_id = $2`,
      [listingId, thirdUserId],
    );

    await asUser(db, ownerId);
    const counts = await db.query<{ favorite_count: number }>(
      `select favorite_count from public.listing_favorite_counts() where listing_id = $1`,
      [listingId],
    );
    expect(counts.rows[0]!.favorite_count).toBe(1);
  });
});

describe('listing_views visibility', () => {
  it('lets the owner count unique views of their listing', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.listing_views (listing_id, viewer_id) values ($1, $2)
       on conflict do nothing`,
      [listingId, thirdUserId],
    );

    await asUser(db, ownerId);
    const r = await db.query<{ n: number }>(
      `select count(*)::int as n from public.listing_views where listing_id = $1`,
      [listingId],
    );
    expect(r.rows[0]!.n).toBe(2);
  });

  it('shows other authenticated users nothing', async () => {
    await asUser(db, otherUserId);
    const r = await db.query(`select id from public.listing_views`);
    expect(r.rows).toHaveLength(0);
  });

  it('shows guests nothing (no grant at all)', async () => {
    await asAnonymous(db);
    await expectError(db.query(`select id from public.listing_views`), 'permission denied');
  });

  it('refuses client writes (server-only counters)', async () => {
    await asUser(db, otherUserId);
    await expectError(
      db.query(`insert into public.listing_views (listing_id, viewer_id) values ($1, $2)`, [
        listingId,
        otherUserId,
      ]),
      'permission denied',
    );
  });
});

describe('phone_reveal_events visibility', () => {
  it('counts every reveal as a separate contact, owner-only', async () => {
    await asSuper(db);
    for (const viewer of [otherUserId, otherUserId, thirdUserId]) {
      await db.query(
        `insert into public.phone_reveal_events (listing_id, viewer_id) values ($1, $2)`,
        [listingId, viewer],
      );
    }

    await asUser(db, ownerId);
    const owned = await db.query<{ n: number }>(
      `select count(*)::int as n from public.phone_reveal_events where listing_id = $1`,
      [listingId],
    );
    expect(owned.rows[0]!.n).toBe(3);

    await asUser(db, otherUserId);
    const foreign = await db.query(`select id from public.phone_reveal_events`);
    expect(foreign.rows).toHaveLength(0);

    await asAnonymous(db);
    await expectError(db.query(`select id from public.phone_reveal_events`), 'permission denied');
  });

  it('is append-only from the client side', async () => {
    await asUser(db, ownerId);
    await expectError(
      db.query(
        `insert into public.phone_reveal_events (listing_id, viewer_id) values ($1, $2)`,
        [listingId, ownerId],
      ),
      'permission denied',
    );
  });
});
