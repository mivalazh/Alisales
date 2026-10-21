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

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => {
  await db?.close();
});

describe('public read model', () => {
  it('anonymous visitors see only active, unhidden listings', async () => {
    await asAnonymous(db);
    const r = await db.query<{ slug: string }>(`select slug from public.listings`);
    const slugs = r.rows.map((x) => x.slug).sort();
    expect(slugs).toEqual([
      'kiaqi-kish-showroom',
      'kioqi-transit',
      'peugeot-206-alice',
      'peugeot-206-black-tehran',
      'peugeot-206-blue-kish',
      'peugeot-206-showroom',
      'shahin-new-tehran',
    ]);
    expect(slugs).not.toContain('dena-plus-sold');
    expect(slugs).not.toContain('tiba-alice-draft');
    expect(slugs).not.toContain('samaned-hidden');
  });

  it('anonymous visitors cannot read the users table', async () => {
    await asAnonymous(db);
    const r = await db.query(`select * from public.users`);
    expect(r.rows).toHaveLength(0);
  });

  it('license documents are column-restricted (permission denied)', async () => {
    await asAnonymous(db);
    await expectError(
      db.query(`select license_photo_path from public.showrooms limit 1`),
      'permission denied',
    );
  });

  it('license RPC returns rows only for owner/admin', async () => {
    await asSuper(db);
    await db.query(
      `update public.showrooms set license_photo_path = 'bob/license.webp' where id = $1`,
      [IDS.showroom],
    );

    await asAnonymous(db);
    const anon = await db.query(`select * from public.get_showroom_license($1)`, [IDS.showroom]);
    expect(anon.rows).toHaveLength(0);

    await asUser(db, IDS.carol); // editor, not owner
    const staff = await db.query(`select * from public.get_showroom_license($1)`, [IDS.showroom]);
    expect(staff.rows).toHaveLength(0);

    await asUser(db, IDS.bob); // owner
    const owner = await db.query<{ license_photo_path: string }>(
      `select * from public.get_showroom_license($1)`,
      [IDS.showroom],
    );
    expect(owner.rows[0]?.license_photo_path).toBe('bob/license.webp');

    await asUser(db, IDS.admin);
    const admin = await db.query(`select * from public.get_showroom_license($1)`, [IDS.showroom]);
    expect(admin.rows).toHaveLength(1);
  });
});

describe('owner boundaries', () => {
  it('users read their own row (incl. phone), never other users', async () => {
    await asUser(db, IDS.alice);
    const own = await db.query<{ phone: string }>(
      `select phone from public.users where id = $1`,
      [IDS.alice],
    );
    expect(own.rows[0]?.phone).toBe('+989000000003');

    const other = await db.query(`select phone from public.users where id = $1`, [IDS.dave]);
    expect(other.rows).toHaveLength(0);
  });

  it('users cannot escalate their own role', async () => {
    await asUser(db, IDS.alice);
    await expectError(
      db.query(`update public.users set role = 'admin' where id = $1`, [IDS.alice]),
      'only admins can change account roles',
    );
  });

  it('alice cannot update another seller\'s listing (0 rows)', async () => {
    await asUser(db, IDS.alice);
    const r = await db.query(
      `update public.listings set price_irr = 1 where id = $1`,
      [LISTINGS.kioqiKish],
    );
    expect(r.affectedRows).toBe(0);
  });

  it('alice can update her own draft', async () => {
    await asUser(db, IDS.alice);
    const r = await db.query(
      `update public.listings set description = 'توضیحات تکمیلی' where id = $1`,
      [LISTINGS.aliceDraft],
    );
    expect(r.affectedRows).toBe(1);
  });

  it('showroom editor can update the showroom\'s listings; outsiders cannot', async () => {
    await asUser(db, IDS.carol);
    const ok = await db.query(
      `update public.listings set description = 'به‌روزرسانی توسط ویرایشگر' where id = $1`,
      [LISTINGS.kioqiKish],
    );
    expect(ok.affectedRows).toBe(1);

    await asUser(db, IDS.alice);
    const denied = await db.query(
      `update public.listings set description = 'دست‌کاری' where id = $1`,
      [LISTINGS.kioqiKish],
    );
    expect(denied.affectedRows).toBe(0);
  });
});

describe('inspection reports', () => {
  it('only inspectors can create reports, only for themselves', async () => {
    await asUser(db, IDS.alice);
    await expectError(
      db.query(
        `insert into public.inspection_reports (inspector_id, brand, model, year, mileage_km)
         values ($1, 'saipa', 'کوییک', 1402, 10000)`,
        [IDS.alice],
      ),
      'row-level security',
    );

    await asUser(db, IDS.inspector);
    const r = await db.query<{ id: string }>(
      `insert into public.inspection_reports (inspector_id, brand, model, year, mileage_km)
       values ($1, 'saipa', 'کوییک', 1402, 10000) returning id`,
      [IDS.inspector],
    );
    expect(r.rows[0]?.id).toBeTruthy();
  });

  it('draft reports are invisible to buyers; finalized ones are public', async () => {
    await asAnonymous(db);
    const all = await db.query(`select id, status from public.inspection_reports`);
    expect(all.rows).toHaveLength(1); // only the finalized seeded report
    expect((all.rows[0] as { status: string }).status).toBe('finalized');
  });

  it('a different inspector cannot update someone else\'s report (0 rows)', async () => {
    await asSuper(db);
    const created = await db.query<{ id: string }>(
      `insert into public.inspection_reports (inspector_id, brand, model, year, mileage_km)
       values ($1, 'saipa', 'تیبا', 1400, 5000) returning id`,
      [IDS.inspector],
    );
    const reportId = created.rows[0]!.id;

    await asUser(db, IDS.bob);
    const r = await db.query(
      `update public.inspection_reports set mileage_km = 1 where id = $1`,
      [reportId],
    );
    expect(r.affectedRows).toBe(0);
  });

  it('report_versions rows are immutable (DB-enforced, even for superuser)', async () => {
    await asSuper(db);
    await expectError(
      db.query(`update public.report_versions set content = '{}'::jsonb where id = $1`, [
        '00000000-0000-0000-0000-000000000051',
      ]),
      'immutable',
    );
  });

  it('non-owners cannot append versions to someone else\'s report', async () => {
    await asUser(db, IDS.alice);
    await expectError(
      db.query(
        `insert into public.report_versions (report_id, version, content, content_hash, created_by)
         values ($1, 99, '{}'::jsonb, repeat('ab', 32), $2)`,
        [IDS.report, IDS.alice],
      ),
      'row-level security',
    );
  });
});

describe('admin moderation powers', () => {
  it('admins can move any listing to any state', async () => {
    await asUser(db, IDS.admin);
    const r = await db.query(
      `update public.listings set state = 'expired' where id = $1`,
      [LISTINGS.denaSold],
    );
    expect(r.affectedRows).toBe(1);
  });

  it('admins can triage abuse reports; reporters see only their own', async () => {
    await asUser(db, IDS.dave);
    await db.query(
      `insert into public.abuse_reports (listing_id, reporter_id, reason, details)
       values ($1, $2, 'wrong_info', 'اطلاعات نادرست')`,
      [LISTINGS.kioqiKish, IDS.dave],
    );

    await asUser(db, IDS.alice);
    const aliceView = await db.query(`select * from public.abuse_reports`);
    expect(aliceView.rows).toHaveLength(0);

    await asUser(db, IDS.admin);
    const adminView = await db.query<{ id: string }>(`select id from public.abuse_reports`);
    expect(adminView.rows).toHaveLength(1);
    const r = await db.query(`update public.abuse_reports set status = 'reviewing'`);
    expect(r.affectedRows).toBe(1);
  });
});

describe('phone masking & messaging isolation', () => {
  it('seller phone is masked until the seller reveals it', async () => {
    await asAnonymous(db);
    const masked = await db.query<{ get_seller_phone: string | null }>(
      `select public.get_seller_phone($1)`,
      [LISTINGS.alice206],
    );
    expect(masked.rows[0]?.get_seller_phone).toBeNull();

    await asSuper(db);
    await db.query(`update public.listings set allow_phone_reveal = true where id = $1`, [
      LISTINGS.alice206,
    ]);
    await asAnonymous(db);
    const revealed = await db.query<{ get_seller_phone: string | null }>(
      `select public.get_seller_phone($1)`,
      [LISTINGS.alice206],
    );
    expect(revealed.rows[0]?.get_seller_phone).toBe('+989000000003');

    await asSuper(db);
    await db.query(`update public.listings set allow_phone_reveal = false where id = $1`, [
      LISTINGS.alice206,
    ]);
  });

  it('buyers can only message sellers of public listings', async () => {
    await asUser(db, IDS.dave);
    const ok = await db.query<{ id: string }>(
      `insert into public.conversations (listing_id, buyer_id, seller_id)
       values ($1, $2, $3) returning id`,
      [LISTINGS.alice206, IDS.dave, IDS.alice],
    );
    const conversationId = ok.rows[0]!.id;

    await expectError(
      db.query(
        `insert into public.conversations (listing_id, buyer_id, seller_id)
         values ($1, $2, $3)`,
        [LISTINGS.aliceDraft, IDS.dave, IDS.alice],
      ),
      'row-level security',
    );

    await db.query(
      `insert into public.messages (conversation_id, sender_id, body)
       values ($1, $2, 'سلام، خودرو هنوز موجود است؟')`,
      [conversationId, IDS.dave],
    );

    // seller sees the message; a stranger sees nothing
    await asUser(db, IDS.alice);
    const seller = await db.query(`select * from public.messages`);
    expect(seller.rows).toHaveLength(1);

    await asUser(db, IDS.carol);
    const stranger = await db.query(`select * from public.messages`);
    expect(stranger.rows).toHaveLength(0);
  });

  it('rate limits messaging at 30 messages / 5 minutes', async () => {
    await asUser(db, IDS.alice);
    const conv = await db.query<{ id: string }>(
      `insert into public.conversations (listing_id, buyer_id, seller_id)
       values ($1, $2, $3) returning id`,
      [LISTINGS.kioqiKish, IDS.alice, IDS.bob],
    );
    const conversationId = conv.rows[0]!.id;

    for (let i = 0; i < 30; i++) {
      await db.query(
        `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, $3)`,
        [conversationId, IDS.alice, `پیام شماره ${i}`],
      );
    }
    await expectError(
      db.query(
        `insert into public.messages (conversation_id, sender_id, body) values ($1, $2, '۳۱')`,
        [conversationId, IDS.alice],
      ),
      'rate_limit',
    );
  });

  it('messages are immutable once sent', async () => {
    await asUser(db, IDS.alice);
    const r = await db.query(`update public.messages set body = 'ویرایش'`);
    expect(r.affectedRows).toBe(0);
  });
});

describe('subscriptions and payments visibility', () => {
  it('account owners see their own subscriptions; strangers see none', async () => {
    await asUser(db, IDS.bob);
    const owner = await db.query(`select id from public.subscriptions`);
    expect(owner.rows).toHaveLength(1);

    await asUser(db, IDS.alice);
    const stranger = await db.query(`select id from public.subscriptions`);
    expect(stranger.rows).toHaveLength(0);
  });

  it('clients cannot create subscriptions directly', async () => {
    await asUser(db, IDS.bob);
    await expectError(
      db.query(
        `insert into public.subscriptions (user_id, plan_id, status)
         values ($1, (select id from public.subscription_plans where code = 'pro'), 'active')`,
        [IDS.bob],
      ),
      'row-level security',
    );
  });

  it('owners cannot alter subscription terms (server-managed)', async () => {
    await asUser(db, IDS.bob);
    await expectError(
      db.query(`update public.subscriptions set period_end = now() + interval '5 years'`),
      'subscription terms are server-managed',
    );
    // Cancellation, however, is allowed:
    const cancel = await db.query(`update public.subscriptions set status = 'cancelled'`);
    expect(cancel.affectedRows).toBe(1);
    await asSuper(db);
    await db.query(`update public.subscriptions set status = 'active' where id = $1`, [
      IDS.basicSub,
    ]);
  });

  it('payment ledger rows are readable by the payer only', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.subscription_payments (subscription_id, provider, provider_ref, amount_irr, status, paid_at)
       values ($1, 'zarinpal', 'RLS-REF', 8000000, 'paid', now())`,
      [IDS.basicSub],
    );

    await asUser(db, IDS.bob);
    const owner = await db.query(`select id from public.subscription_payments`);
    expect(owner.rows).toHaveLength(1);

    await asUser(db, IDS.alice);
    const stranger = await db.query(`select id from public.subscription_payments`);
    expect(stranger.rows).toHaveLength(0);
  });
});
