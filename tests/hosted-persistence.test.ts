import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { IDS, asAnonymous, asSuper, asUser, createDb, expectError } from './helpers/pg';

/**
 * Migration 0007 — parts listings + structured visit metadata.
 *
 * Rules under test:
 *  - a listing is exactly one shape: vehicle (vehicle_id required) or part
 *    (vehicle_id null, details in part_details);
 *  - part details are readable by the public for public listings only, and are
 *    never client-writable;
 *  - a visit message keeps its structured slot, and an impossible slot
 *    (25:99) is rejected by the database itself;
 *  - the public projection and the search RPC serve parts alongside cars.
 */
let db: PGlite;
const SLUG = 'part-test-brake';
let partListingId: string;

beforeAll(async () => {
  db = await createDb();
  await asSuper(db);
});

afterAll(async () => {
  await db?.close();
});

async function insertPart(slug: string, state = 'active'): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into public.listings
       (slug, created_by, kind, price_irr, city, description, state, published_at)
     values ($1, $2, 'part', 4500000, 'kish', 'دیسک ترمز نو و سالم مناسب پژو ۲۰۶.', $3::listing_state, now())
     returning id`,
    [slug, IDS.alice, state],
  );
  return r.rows[0]!.id;
}

async function insertPartDetails(listingId: string, title = 'دیسک ترمز جلو پژو 206'): Promise<void> {
  await db.query(
    `insert into public.part_details (listing_id, category, title, origin, condition, part_number, compatibility, warranty)
     values ($1, 'brake', $2, 'original', 'new', 'AB-1234', null, '6 ماه')`,
    [listingId, title],
  );
}

describe('0007 listings: vehicle | part', () => {
  it('defaults kind to vehicle so every existing row stays a car', async () => {
    const r = await db.query<{ kind: string }>(
      `select kind from public.listings where id = '00000000-0000-0000-0000-000000000047'`,
    );
    expect(r.rows[0]!.kind).toBe('vehicle');
  });

  it('rejects an unknown kind', async () => {
    await expectError(
      db.query(
        `insert into public.listings (slug, created_by, kind, price_irr, city, description, state)
         values ('bad-kind', $1, 'boat', 1, 'kish', 'داده آزمایشی', 'draft')`,
        [IDS.alice],
      ),
      'listings_kind_valid',
    );
  });

  it('refuses a part that claims a vehicle row', async () => {
    const vehicle = await db.query<{ id: string }>(
      `insert into public.vehicles (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition)
       values ($1, 'peugeot', '206', 1390, 120000, 'manual', 'petrol', 'white', 'used') returning id`,
      [IDS.alice],
    );
    await expectError(
      db.query(
        `insert into public.listings (slug, created_by, kind, vehicle_id, price_irr, city, description, state)
         values ('part-with-vehicle', $1, 'part', $2, 1, 'kish', 'داده آزمایشی', 'draft')`,
        [IDS.alice, vehicle.rows[0]!.id],
      ),
      'listings_kind_shape',
    );
  });

  it('refuses a vehicle listing without its vehicle row', async () => {
    await expectError(
      db.query(
        `insert into public.listings (slug, created_by, kind, price_irr, city, description, state)
         values ('vehicle-without-row', $1, 'vehicle', 1, 'kish', 'داده آزمایشی', 'draft')`,
        [IDS.alice],
      ),
      'listings_kind_shape',
    );
  });
});

describe('0007 part_details', () => {
  it('stores part details for a published part', async () => {
    partListingId = await insertPart(SLUG);
    await insertPartDetails(partListingId);

    const r = await db.query<{ category: string; title: string; origin: string }>(
      `select category, title, origin from public.part_details where listing_id = $1`,
      [partListingId],
    );
    expect(r.rows[0]).toEqual({
      category: 'brake',
      title: 'دیسک ترمز جلو پژو 206',
      origin: 'original',
    });
  });

  it('allows one details row per listing', async () => {
    await expectError(insertPartDetails(partListingId), 'duplicate key');
  });

  it('rejects an unknown category at the database level', async () => {
    const extra = await insertPart('part-test-extra');
    await expectError(
      db.query(
        `insert into public.part_details (listing_id, category, title, origin, condition)
         values ($1, 'spaceship', 'قطعه آزمایشی', 'original', 'new')`,
        [extra],
      ),
      'part_details_category_check',
    );
  });

  it('deletes details with their listing', async () => {
    const doomed = await insertPart('part-test-doomed');
    await insertPartDetails(doomed);
    await db.query(`delete from public.listings where id = $1`, [doomed]);
    const r = await db.query(`select listing_id from public.part_details where listing_id = $1`, [
      doomed,
    ]);
    expect(r.rows).toHaveLength(0);
  });

  it('is public for a public listing, hidden for a hidden one, and never client-writable', async () => {
    await asAnonymous(db);
    const visible = await db.query(`select title from public.part_details where listing_id = $1`, [
      partListingId,
    ]);
    expect(visible.rows).toHaveLength(1);

    await expectError(
      db.query(
        `insert into public.part_details (listing_id, category, title, origin, condition)
         values ($1, 'brake', 'قطعه جعلی', 'unknown', 'new')`,
        [partListingId],
      ),
      'permission denied',
    );

    await asSuper(db);
    await db.query(`update public.listings set hidden_at = now() where id = $1`, [partListingId]);
    await asAnonymous(db);
    const hidden = await db.query(`select title from public.part_details where listing_id = $1`, [
      partListingId,
    ]);
    expect(hidden.rows).toHaveLength(0);

    await asSuper(db);
    await db.query(`update public.listings set hidden_at = null where id = $1`, [partListingId]);
  });
});

describe('0007 public projection', () => {
  it('exposes kind and part fields on listing_cards', async () => {
    await asSuper(db);
    const r = await db.query<{
      kind: string;
      part_title: string;
      part_category: string;
      model: string;
      year: number;
    }>(
      `select kind, part_title, part_category, model, year
       from public.listing_cards where slug = $1`,
      [SLUG],
    );
    expect(r.rows[0]).toMatchObject({
      kind: 'part',
      part_title: 'دیسک ترمز جلو پژو 206',
      part_category: 'brake',
      model: 'دیسک ترمز جلو پژو 206',
      year: 0,
    });
  });

  it('keeps cars on the vehicle projection', async () => {
    const r = await db.query<{ kind: string; part_title: string | null; brand: string }>(
      `select kind, part_title, brand from public.listing_cards
       where id = '00000000-0000-0000-0000-000000000047'`,
    );
    expect(r.rows[0]).toMatchObject({ kind: 'vehicle', part_title: null });
    expect(r.rows[0]!.brand).not.toBe('');
  });

  it('serves parts through search_listings', async () => {
    const r = await db.query<{ slug: string }>(
      `select slug from public.search_listings('{}'::jsonb, 100, 0) where slug = $1`,
      [SLUG],
    );
    expect(r.rows).toHaveLength(1);
  });

  it('keeps hidden parts out of the public read path', async () => {
    await asSuper(db);
    await db.query(`update public.listings set hidden_at = now() where id = $1`, [partListingId]);
    const hidden = await db.query<{ slug: string }>(
      `select slug from public.search_listings('{}'::jsonb, 100, 0) where slug = $1`,
      [SLUG],
    );
    expect(hidden.rows).toHaveLength(0);
    await db.query(`update public.listings set hidden_at = null where id = $1`, [partListingId]);
  });
});

describe('0007 structured visit messages', () => {
  let conversationId: string;

  beforeAll(async () => {
    await asSuper(db);
    const owner = await db.query<{ created_by: string }>(
      `select created_by from public.listings where id = '00000000-0000-0000-0000-000000000047'`,
    );
    const sellerId = owner.rows[0]!.created_by;
    const buyerId = sellerId === IDS.bob ? IDS.carol : IDS.bob;
    const conv = await db.query<{ id: string }>(
      `insert into public.conversations (listing_id, buyer_id, seller_id)
       values ('00000000-0000-0000-0000-000000000047', $1, $2) returning id`,
      [buyerId, sellerId],
    );
    conversationId = conv.rows[0]!.id;
  });

  it('defaults normal chat to kind=text with no slot', async () => {
    const r = await db.query<{ kind: string; visit_date: string | null }>(
      `insert into public.messages (conversation_id, sender_id, body)
       values ($1, $2, 'سلام، موجود است؟') returning kind, visit_date`,
      [conversationId, IDS.bob],
    );
    expect(r.rows[0]).toMatchObject({ kind: 'text', visit_date: null });
  });

  it('stores a visit request with its slot', async () => {
    const r = await db.query<{ kind: string; visit_date: string; visit_time: string }>(
      `insert into public.messages (conversation_id, sender_id, body, kind, visit_date, visit_time)
       values ($1, $2, 'سلام، می‌خواستم وقت بازدید بگیرم.', 'visit_request', '2026-11-02', '17:30')
       returning kind, visit_date::text, visit_time`,
      [conversationId, IDS.bob],
    );
    expect(r.rows[0]).toMatchObject({
      kind: 'visit_request',
      visit_date: '2026-11-02',
      visit_time: '17:30',
    });
  });

  it('rejects an impossible time like 25:99', async () => {
    await expectError(
      db.query(
        `insert into public.messages (conversation_id, sender_id, body, kind, visit_date, visit_time)
         values ($1, $2, 'زمان نامعتبر', 'visit_request', '2026-11-02', '25:99')`,
        [conversationId, IDS.bob],
      ),
      'messages_visit_time_format',
    );
  });

  it('rejects a time without a date', async () => {
    await expectError(
      db.query(
        `insert into public.messages (conversation_id, sender_id, body, kind, visit_time)
         values ($1, $2, 'بدون تاریخ', 'visit_request', '10:00')`,
        [conversationId, IDS.bob],
      ),
      'messages_visit_time_needs_date',
    );
  });

  it('rejects a slot on a plain text message', async () => {
    await expectError(
      db.query(
        `insert into public.messages (conversation_id, sender_id, body, visit_date)
         values ($1, $2, 'پیام ساده', '2026-11-02')`,
        [conversationId, IDS.bob],
      ),
      'messages_text_has_no_visit',
    );
  });

  it('rejects an unknown message kind', async () => {
    await expectError(
      db.query(
        `insert into public.messages (conversation_id, sender_id, body, kind)
         values ($1, $2, 'نوع ناشناخته', 'visit_maybe')`,
        [conversationId, IDS.bob],
      ),
      'messages_kind_valid',
    );
  });

  it('is readable by the two participants only', async () => {
    const conv = await db.query<{ buyer_id: string; seller_id: string }>(
      `select buyer_id, seller_id from public.conversations where id = $1`,
      [conversationId],
    );
    const { buyer_id: buyerId, seller_id: sellerId } = conv.rows[0]!;

    await asUser(db, buyerId);
    const asBuyer = await db.query<{ body: string }>(
      `select body from public.messages where conversation_id = $1 and kind = 'visit_request'`,
      [conversationId],
    );
    expect(asBuyer.rows).toHaveLength(1);

    await asSuper(db);
    const stranger = [IDS.dave, IDS.alice, IDS.carol]
      .filter((id) => id !== buyerId && id !== sellerId)
      .pop();
    if (stranger) {
      await asUser(db, stranger);
      const asStranger = await db.query(
        `select body from public.messages where conversation_id = $1`,
        [conversationId],
      );
      expect(asStranger.rows).toHaveLength(0);
    }
  });
});
