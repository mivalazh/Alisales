import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { IDS, asAnonymous, asSuper, asUser, createDb, expectError } from './helpers/pg';

/**
 * Migration 0010 — durable platform flows.
 *
 * Verifies the hosted shape and access rules for story submissions, inspection
 * bookings, support tickets, AI counters and the singleton platform settings.
 */
let db: PGlite;

beforeAll(async () => {
  db = await createDb();
  await asSuper(db);
});

afterAll(async () => {
  await db?.close();
});

describe('0010 story_submissions', () => {
  it('keeps pending stories private and publishes approved ones', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.story_submissions
         (title, media_url, media_kind, author_id, author_name, listing_slug, status)
       values ('استوری در انتظار', 'data:image/webp;base64,AAAA', 'image', $1, 'آلیس', null, 'pending')`,
      [IDS.alice],
    );

    await asAnonymous(db);
    const pending = await db.query(`select id from public.story_submissions`);
    expect(pending.rows).toHaveLength(0);

    await asSuper(db);
    await db.query(
      `update public.story_submissions set status = 'approved'
       where title = 'استوری در انتظار'`,
    );
    await asAnonymous(db);
    const approved = await db.query<{ title: string }>(
      `select title from public.story_submissions`,
    );
    expect(approved.rows).toEqual([{ title: 'استوری در انتظار' }]);
  });

  it('rejects unknown status and media kinds', async () => {
    await asSuper(db);
    await expectError(
      db.query(
        `insert into public.story_submissions
           (title, media_url, media_kind, author_id, status)
         values ('bad', '/x.webp', 'image', $1, 'archived')`,
        [IDS.alice],
      ),
      'story_submissions_status_check',
    );
    await expectError(
      db.query(
        `insert into public.story_submissions
           (title, media_url, media_kind, author_id)
         values ('bad', '/x.webp', 'audio', $1)`,
        [IDS.alice],
      ),
      'story_submissions_media_kind_check',
    );
  });
});

describe('0010 inspection_bookings', () => {
  it('stores guest bookings privately for the admin queue', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.inspection_bookings
         (name, phone, date, time, vehicle, listing_slug, listing_title, note)
       values ('مهدی رضایی', '09120000000', '2026-11-20', '10:30',
               'Land Cruiser VXR', 'land-cruiser-kish', 'Land Cruiser VXR', null)`,
    );

    await asAnonymous(db);
    await expectError(
      db.query(`select phone from public.inspection_bookings`),
      'permission denied',
    );

    await asSuper(db);
    const row = await db.query<{ status: string; phone: string }>(
      `select status, phone from public.inspection_bookings`,
    );
    expect(row.rows[0]).toEqual({ status: 'pending', phone: '09120000000' });
  });

  it('rejects an unknown booking status', async () => {
    await asSuper(db);
    await expectError(
      db.query(
        `insert into public.inspection_bookings (name, phone, date, time, vehicle, status)
         values ('تست', '09120000001', '2026-11-21', '11:00', 'خودرو', 'lost')`,
      ),
      'inspection_bookings_status_check',
    );
  });
});

describe('0010 support_requests', () => {
  it('stores tickets privately and keeps tracking codes unique', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.support_requests
         (kind, topic, code, status, reply, name, contact, model, message)
       values ('ticket', 'technical', 'AS-ABC12345', 'answered', 'پاسخ',
               'سارا', '09120000000', '', 'متن تیکت')`,
    );

    await asAnonymous(db);
    await expectError(
      db.query(`select contact from public.support_requests`),
      'permission denied',
    );

    await asSuper(db);
    await expectError(
      db.query(
        `insert into public.support_requests (kind, topic, code, name, contact, message)
         values ('ticket', 'technical', 'AS-ABC12345', 'سارا', '0912', 'تکرار')`,
      ),
      'duplicate key',
    );
  });

  it('rejects unknown topics', async () => {
    await asSuper(db);
    await expectError(
      db.query(
        `insert into public.support_requests (kind, topic, code, name, contact, message)
         values ('ticket', 'sales', 'AS-BAD00001', 'نام', '0912', 'متن')`,
      ),
      'support_requests_topic_check',
    );
  });
});

describe('0010 ai_faq_counts and settings', () => {
  it('increments FAQ counters through the service-role function', async () => {
    await asUser(db, IDS.admin, 'service_role');
    await db.query(`select public.increment_faq_topic('تست شمارنده')`);
    await db.query(`select public.increment_faq_topic('تست شمارنده')`);
    await asSuper(db);
    const row = await db.query<{ topic: string; count: number }>(
      `select topic, count from public.ai_faq_counts where topic = 'تست شمارنده'`,
    );
    expect(row.rows[0]).toEqual({ topic: 'تست شمارنده', count: 2 });
  });

  it('starts with the story paid guard off and allows an upsert', async () => {
    await asSuper(db);
    const initial = await db.query<{ story_paid_guard: boolean }>(
      `select story_paid_guard from public.platform_settings where singleton = true`,
    );
    expect(initial.rows[0]?.story_paid_guard).toBe(false);

    await db.query(
      `insert into public.platform_settings (singleton, story_paid_guard)
       values (true, true)
       on conflict (singleton) do update set story_paid_guard = true`,
    );
    const updated = await db.query<{ story_paid_guard: boolean }>(
      `select story_paid_guard from public.platform_settings where singleton = true`,
    );
    expect(updated.rows[0]?.story_paid_guard).toBe(true);
  });
});
