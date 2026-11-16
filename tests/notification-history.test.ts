import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { IDS, LISTINGS, asSuper, asUser, createDb, expectError } from './helpers/pg';

/**
 * 0012 — sold / price-drop event history and the server-side read marker.
 *
 * The bell must not rely on one device's localStorage: an event is durable,
 * versioned by time, and readable only by the server; the read marker is one
 * row per account.
 */
let db: PGlite;

beforeAll(async () => {
  db = await createDb();
  await asSuper(db);
});

afterAll(async () => {
  await db?.close();
});

describe('0012 listing_events', () => {
  it('stores a sold event and a real price drop', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.listing_events (listing_id, kind)
       values ($1, 'sold')`,
      [LISTINGS.alice206],
    );
    const drop = await db.query<{
      kind: string;
      price_irr: number;
      previous_price_irr: number;
    }>(
      `insert into public.listing_events
         (listing_id, kind, price_irr, previous_price_irr)
       values ($1, 'price_drop', 900000000000, 1000000000000)
       returning kind, price_irr, previous_price_irr`,
      [LISTINGS.alice206],
    );
    expect(drop.rows[0]).toEqual({
      kind: 'price_drop',
      price_irr: 900000000000,
      previous_price_irr: 1000000000000,
    });
  });

  it('rejects an incomplete or non-decreasing price drop', async () => {
    await asSuper(db);
    await expectError(
      db.query(
        `insert into public.listing_events (listing_id, kind, price_irr)
         values ($1, 'price_drop', 5)`,
        [LISTINGS.alice206],
      ),
      'listing_events_check',
    );
    await expectError(
      db.query(
        `insert into public.listing_events
           (listing_id, kind, price_irr, previous_price_irr)
         values ($1, 'price_drop', 10, 10)`,
        [LISTINGS.alice206],
      ),
      'listing_events_check',
    );
  });

  it('records sold transitions and real price drops atomically', async () => {
    await asSuper(db);
    await db.query(
      `update public.listings
       set state = 'sold', sold_at = '2026-11-15T09:00:00Z'
       where id = $1`,
      [LISTINGS.kioqiKish],
    );
    const sold = await db.query<{ kind: string; created_at: string }>(
      `select kind, created_at::text from public.listing_events
       where listing_id = $1 order by created_at`,
      [LISTINGS.kioqiKish],
    );
    expect(sold.rows).toHaveLength(1);
    expect(sold.rows[0]!.kind).toBe('sold');
    expect(sold.rows[0]!.created_at).toBeTruthy();

    const previous = await db.query<{ price_irr: number }>(
      `select price_irr from public.listings where id = $1`,
      [LISTINGS.kioqiTransit],
    );
    const oldPrice = previous.rows[0]!.price_irr;
    await db.query(
      `update public.listings set price_irr = $2 where id = $1`,
      [LISTINGS.kioqiTransit, oldPrice - 1_000_000],
    );
    const drop = await db.query<{
      kind: string;
      price_irr: number;
      previous_price_irr: number;
    }>(
      `select kind, price_irr, previous_price_irr from public.listing_events
       where listing_id = $1`,
      [LISTINGS.kioqiTransit],
    );
    expect(drop.rows).toEqual([
      { kind: 'price_drop', price_irr: oldPrice - 1_000_000, previous_price_irr: oldPrice },
    ]);

    await db.query(
      `update public.listings set price_irr = $2 where id = $1`,
      [LISTINGS.kioqiTransit, oldPrice],
    );
    const afterIncrease = await db.query(
      `select id from public.listing_events where listing_id = $1`,
      [LISTINGS.kioqiTransit],
    );
    expect(afterIncrease.rows).toHaveLength(1);
  });

  it('is service-role only for clients', async () => {
    await asUser(db, IDS.alice);
    await expectError(
      db.query(`select id from public.listing_events`),
      'permission denied',
    );
    await expectError(
      db.query(
        `insert into public.listing_events (listing_id, kind)
         values ($1, 'sold')`,
        [LISTINGS.alice206],
      ),
      'permission denied',
    );
  });
});

describe('0012 notification_reads', () => {
  it('keeps one read marker per account', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.notification_reads (user_id, read_at)
       values ($1, '2026-11-15T10:00:00Z')`,
      [IDS.alice],
    );
    await db.query(
      `update public.notification_reads set read_at = '2026-11-15T11:00:00Z'
       where user_id = $1`,
      [IDS.alice],
    );
    const rows = await db.query<{ read_at: string }>(
      `select read_at::text from public.notification_reads where user_id = $1`,
      [IDS.alice],
    );
    expect(rows.rows).toEqual([{ read_at: '2026-11-15 11:00:00+00' }]);
  });

  it('is not client-readable or writable', async () => {
    await asUser(db, IDS.bob);
    await expectError(
      db.query(`select read_at from public.notification_reads`),
      'permission denied',
    );
    await expectError(
      db.query(
        `insert into public.notification_reads (user_id) values ($1)`,
        [IDS.bob],
      ),
      'permission denied',
    );
  });
});

describe('fixture notification history', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'alisales-notifications-'));
    process.env.DEMO_DATA_DIR = dir;
  });

  afterAll(() => {
    delete process.env.DEMO_DATA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('persists events and the account read marker', async () => {
    const store = await import('../apps/web/lib/data/notification-store');
    await store.recordListingEvent({
      listingId: LISTINGS.alice206,
      kind: 'sold',
      createdAt: '2026-11-15T10:00:00Z',
    });
    await store.recordListingEvent({
      listingId: LISTINGS.alice206,
      kind: 'price_drop',
      previousPriceIRR: 1_000_000_000_000,
      priceIRR: 900_000_000_000,
      createdAt: '2026-11-15T11:00:00Z',
    });

    const events = await store.listListingEvents([LISTINGS.alice206]);
    expect(events.map((event) => event.kind)).toEqual(['price_drop', 'sold']);

    expect(await store.notificationReadAt(IDS.alice)).toBeNull();
    const readAt = await store.markNotificationsRead(IDS.alice);
    expect(await store.notificationReadAt(IDS.alice)).toBe(readAt);
  });
});
