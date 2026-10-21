import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  IDS,
  LISTINGS,
  asAnonymous,
  asSuper,
  asUser,
  backdateListings,
  createDb,
  expectError,
} from './helpers/pg';

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
  // Dave runs a Pro showroom-free account up front so the rate-limit test
  // (5/hour) is not masked by the plan limit.
  await asSuper(db);
  await db.query(
    `insert into public.subscriptions (user_id, plan_id, status, period_end)
     select $1, pl.id, 'active', now() + interval '1 month'
     from public.subscription_plans pl where pl.code = 'pro'`,
    [IDS.dave],
  );
});
afterAll(async () => {
  await db?.close();
});

async function insertDraftListing(vehicleId: string, slug: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into public.listings (slug, created_by, vehicle_id, price_irr, city, description, state)
     values ($1, $2, $3, 900000000000, 'kish', 'آگهی آزمایشی برای تست سقف طرح.', 'draft')
     returning id`,
    [slug, IDS.alice, vehicleId],
  );
  return r.rows[0]!.id;
}

async function insertVehicle(slugSuffix: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into public.vehicles (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition)
     values ($1, 'saipa', 'کوییک', 1402, 30000, 'manual', 'petrol', 'white', 'used') returning id`,
    [IDS.alice],
  );
  void slugSuffix;
  return r.rows[0]!.id;
}

describe('2-free-listing limit for individuals', () => {
  it('seeds the free plan at exactly 2 concurrent listings', async () => {
    const r = await db.query<{ listing_limit: number }>(
      `select public.listing_limit_for($1, null) as listing_limit`,
      [IDS.alice],
    );
    expect(Number(r.rows[0]?.listing_limit)).toBe(2);
  });

  it('rejects a 3rd listing (drafts consume slots, so the limit cannot be gamed)', async () => {
    await asUser(db, IDS.alice);
    await expectError(
      insertDraftListing(await insertVehicle('a'), 'third-listing-blocked'),
      'plan_limit',
    );
  });

  it('pausing does not free a slot', async () => {
    await asUser(db, IDS.alice);
    await db.query(`update public.listings set state = 'paused' where id = $1`, [
      LISTINGS.alice206,
    ]);
    await expectError(
      insertDraftListing(await insertVehicle('b'), 'still-blocked-while-paused'),
      'plan_limit',
    );
  });

  it('selling frees a slot immediately', async () => {
    await asUser(db, IDS.admin);
    await db.query(`update public.listings set state = 'sold' where id = $1`, [LISTINGS.alice206]);

    await asUser(db, IDS.alice);
    const id = await insertDraftListing(await insertVehicle('c'), 'fourth-listing-ok');
    expect(id).toBeTruthy();
  });

  it('upgrade → Basic lifts the limit to 10, then blocks the 11th', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.subscriptions (user_id, plan_id, status, period_end)
       select $1, pl.id, 'active', now() + interval '1 month'
       from public.subscription_plans pl where pl.code = 'basic'`,
      [IDS.alice],
    );

    const limit = await db.query<{ listing_limit: number }>(
      `select public.listing_limit_for($1, null) as listing_limit`,
      [IDS.alice],
    );
    expect(Number(limit.rows[0]?.listing_limit)).toBe(10);

    // slots used: draft + 1 new draft = 2 → add 8 more to reach 10
    await asUser(db, IDS.alice);
    for (let i = 0; i < 4; i++) {
      await insertDraftListing(await insertVehicle(`d${i}`), `paid-listing-${i}`);
      await backdateListings(db, IDS.alice);
    }
    for (let i = 4; i < 8; i++) {
      await insertDraftListing(await insertVehicle(`d${i}`), `paid-listing-${i}`);
      await backdateListings(db, IDS.alice);
    }

    await expectError(
      insertDraftListing(await insertVehicle('e'), 'eleventh-blocked'),
      'plan_limit',
    );
  });

  it('rate limits creation to 5 per hour regardless of plan', async () => {
    await asUser(db, IDS.dave); // Pro plan would allow 40 — the hourly cap fires first
    await expectError(
      (async () => {
        for (let i = 0; i < 6; i++) {
          const v = await db.query<{ id: string }>(
            `insert into public.vehicles (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition)
             values ($1, 'saipa', 'ساینا', 1401, 10000, 'manual', 'petrol', 'gray', 'used') returning id`,
            [IDS.dave],
          );
          await db.query(
            `insert into public.listings (slug, created_by, vehicle_id, price_irr, city, description, state)
             values ($1, $2, $3, 800000000000, 'kish', 'تست سقف نرخ ایجاد آگهی.', 'draft')`,
            [`dave-spam-${i}`, IDS.dave, v.rows[0]!.id],
          );
        }
      })(),
      'rate_limit',
    );
  });
});

describe('showroom plans & lapsed subscriptions', () => {
  it('showroom with live Basic subscription gets 10 slots and priority 1', async () => {
    const r = await db.query<{ listing_limit: number; search_priority: number }>(
      `select ep.listing_limit, ep.search_priority from public.effective_plan(null, $1) ep`,
      [IDS.showroom],
    );
    expect(Number(r.rows[0]?.listing_limit)).toBe(10);
    expect(Number(r.rows[0]?.search_priority)).toBe(1);
  });

  it('lapse hides the showroom\'s listings — hidden, never deleted', async () => {
    await asSuper(db);
    const before = await db.query<{ count: string }>(
      `select count(*) from public.listings where showroom_id = $1`,
      [IDS.showroom],
    );

    await db.query(`update public.subscriptions set status = 'expired' where id = $1`, [
      IDS.basicSub,
    ]);

    await asAnonymous(db);
    const visible = await db.query<{ slug: string }>(
      `select slug from public.listings where showroom_id = $1`,
      [IDS.showroom],
    );
    expect(visible.rows).toHaveLength(0);

    const search = await db.query<{ slug: string }>(
      `select slug from public.search_listings('{}'::jsonb)`,
    );
    expect(search.rows.map((r) => r.slug)).not.toContain('kiaqi-kish-showroom');

    await asSuper(db);
    const after = await db.query<{ count: string }>(
      `select count(*) from public.listings where showroom_id = $1`,
      [IDS.showroom],
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count); // rows untouched
  });

  it('lapsed showrooms cannot add new listings (limit 0)', async () => {
    const r = await db.query<{ listing_limit: number }>(
      `select public.listing_limit_for(null, $1) as listing_limit`,
      [IDS.showroom],
    );
    expect(Number(r.rows[0]?.listing_limit)).toBe(0);
  });

  it('renewal restores visibility', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.subscriptions (showroom_id, plan_id, status, period_end)
       select $1, pl.id, 'active', now() + interval '1 month'
       from public.subscription_plans pl where pl.code = 'basic'`,
      [IDS.showroom],
    );
    await asAnonymous(db);
    const visible = await db.query<{ slug: string }>(
      `select slug from public.listings where showroom_id = $1`,
      [IDS.showroom],
    );
    expect(visible.rows.length).toBeGreaterThan(0);
  });

  it('Pro plan resolves 40 slots and priority 2', async () => {
    const r = await db.query<{ listing_limit: number; search_priority: number }>(
      `select ep.listing_limit, ep.search_priority from public.effective_plan($1, null) ep`,
      [IDS.dave],
    );
    expect(Number(r.rows[0]?.listing_limit)).toBe(40);
    expect(Number(r.rows[0]?.search_priority)).toBe(2);
  });
});

describe('price anomaly → review', () => {
  it('flags a listing far below the segment median and keeps it in review', async () => {
    // Segment has 3 active پژو ۲۰۶ listings (≈1.1T IRR median) in the fixtures.
    await asUser(db, IDS.inspector); // any authenticated non-admin poster
    const v = await db.query<{ id: string }>(
      `insert into public.vehicles (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition)
       values ($1, 'ikco', 'پژو ۲۰۶', 1401, 90000, 'manual', 'petrol', 'red', 'used') returning id`,
      [IDS.inspector],
    );
    const r = await db.query<{ price_anomaly: boolean }>(
      `insert into public.listings (slug, created_by, vehicle_id, price_irr, city, description, state)
       values ('suspicious-206', $1, $2, 300000000000, 'kish', 'قیمت غیرعادی نسبت به بازار.', 'pending_review')
       returning price_anomaly`,
      [IDS.inspector, v.rows[0]!.id],
    );
    expect(r.rows[0]?.price_anomaly).toBe(true);
  });

  it('an active listing with an anomalous price edit bounces back to review', async () => {
    await asUser(db, IDS.inspector);
    const v = await db.query<{ id: string }>(
      `insert into public.vehicles (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition)
       values ($1, 'ikco', 'پژو ۲۰۶', 1400, 80000, 'manual', 'petrol', 'blue', 'used') returning id`,
      [IDS.inspector],
    );
    const created = await db.query<{ id: string }>(
      `insert into public.listings (slug, created_by, vehicle_id, price_irr, city, description, state)
       values ('fair-206', $1, $2, 1100000000000, 'kish', 'قیمت منطقی.', 'pending_review')
       returning id`,
      [IDS.inspector, v.rows[0]!.id],
    );
    await asUser(db, IDS.admin);
    await db.query(`update public.listings set state = 'active' where id = $1`, [
      created.rows[0]!.id,
    ]);

    await asUser(db, IDS.inspector);
    const bounced = await db.query<{ state: string; price_anomaly: boolean }>(
      `update public.listings set price_irr = 9900000000000 where id = $1 returning state, price_anomaly`,
      [created.rows[0]!.id],
    );
    expect(bounced.rows[0]?.state).toBe('pending_review');
    expect(bounced.rows[0]?.price_anomaly).toBe(true);
  });
});

describe('abuse threshold auto-hide', () => {
  it('hides a listing after 5 non-dismissed reports', async () => {
    await asSuper(db);
    const v = await db.query<{ id: string }>(
      `insert into public.vehicles (created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition)
       values ($1, 'saipa', 'پراید', 1395, 200000, 'manual', 'petrol', 'white', 'used') returning id`,
      [IDS.bob],
    );
    const listing = await db.query<{ id: string }>(
      `insert into public.listings (slug, created_by, showroom_id, vehicle_id, price_irr, city, description, state, published_at)
       values ('abuse-target', $1, $2, $3, 400000000000, 'kish', 'هدف گزارش‌های سوءاستفاده.', 'active', now())
       returning id`,
      [IDS.bob, IDS.showroom, v.rows[0]!.id],
    );
    const listingId = listing.rows[0]!.id;

    const reporters = ['00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000102',
      '00000000-0000-0000-0000-000000000103',
      '00000000-0000-0000-0000-000000000104',
      '00000000-0000-0000-0000-000000000105'];
    for (const reporter of reporters) {
      await asSuper(db);
      await db.query(
        `insert into auth.users (id, phone) values ($1, $2) on conflict (id) do nothing`,
        [reporter, `phone-${reporter}`],
      );
      await db.query(
        `insert into public.users (id, phone, display_name) values ($1, $2, 'گزارش‌دهنده') on conflict (id) do nothing`,
        [reporter, `p-${reporter}`],
      );
      await asUser(db, reporter);
      await db.query(
        `insert into public.abuse_reports (listing_id, reporter_id, reason) values ($1, $2, 'fraud')`,
        [listingId, reporter],
      );
    }

    await asSuper(db);
    const hidden = await db.query<{ hidden_at: string | null; hidden_reason: string | null }>(
      `select hidden_at, hidden_reason from public.listings where id = $1`,
      [listingId],
    );
    expect(hidden.rows[0]?.hidden_at).toBeTruthy();
    expect(hidden.rows[0]?.hidden_reason).toBe('abuse_threshold');

    await asAnonymous(db);
    const visible = await db.query(`select id from public.listings where id = $1`, [listingId]);
    expect(visible.rows).toHaveLength(0);
  });

  it('duplicate reports from the same user are rejected', async () => {
    await asUser(db, IDS.dave);
    await db.query(
      `insert into public.abuse_reports (listing_id, reporter_id, reason)
       values ($1, $2, 'spam')`,
      [LISTINGS.kioqiKish, IDS.dave],
    );
    await expectError(
      db.query(
        `insert into public.abuse_reports (listing_id, reporter_id, reason)
         values ($1, $2, 'spam')`,
        [LISTINGS.kioqiKish, IDS.dave],
      ),
      'duplicate key',
    );
  });
});
