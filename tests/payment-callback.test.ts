import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { IDS, asAnonymous, asSuper, asUser, createDb } from './helpers/pg';

let db: PGlite;
const DAVE_SUB = '00000000-0000-0000-0000-000000000060';

beforeAll(async () => {
  db = await createDb();
  await asSuper(db);
  await db.query(
    `insert into public.subscriptions (id, user_id, plan_id, status, period_end)
     select $1, $2, pl.id, 'pending', now() + interval '1 month'
     from public.subscription_plans pl where pl.code = 'basic'`,
    [DAVE_SUB, IDS.dave],
  );
});
afterAll(async () => {
  await db?.close();
});

async function callCallback(providerRef: string, paid: boolean, sub = DAVE_SUB) {
  const r = await db.query<{ apply_payment_result: Record<string, unknown> }>(
    `select public.apply_payment_result('zarinpal', $1, $2, 8000000, $3, '{"source":"test"}'::jsonb)`,
    [providerRef, sub, paid],
  );
  return r.rows[0]!.apply_payment_result;
}

async function periodEnd(): Promise<string> {
  const r = await db.query<{ period_end: string }>(
    `select period_end::text from public.subscriptions where id = $1`,
    [DAVE_SUB],
  );
  return r.rows[0]!.period_end;
}

describe('payment callback idempotency (apply_payment_result)', () => {
  it('activates the subscription and extends the period on first payment', async () => {
    const before = await periodEnd();
    const result = await callCallback('AUTH-1000', true);
    expect(result).toMatchObject({ idempotent: false, paid: true });

    const status = await db.query<{ status: string }>(
      `select status from public.subscriptions where id = $1`,
      [DAVE_SUB],
    );
    expect(status.rows[0]?.status).toBe('active');

    const after = await periodEnd();
    const months = (Date.parse(after) - Date.parse(before)) / (30 * 24 * 3600 * 1000);
    expect(months).toBeCloseTo(1, 1);
  });

  it('replaying the same callback is a no-op (single extension, single ledger row)', async () => {
    const before = await periodEnd();
    const replay = await callCallback('AUTH-1000', true);
    expect(replay).toMatchObject({ idempotent: true, paid: true });
    expect(await periodEnd()).toBe(before);

    const rows = await db.query<{ count: string }>(
      `select count(*) from public.subscription_payments where provider_ref = 'AUTH-1000'`,
    );
    expect(Number(rows.rows[0]?.count)).toBe(1);
  });

  it('a failed callback writes a ledger row without extending', async () => {
    const before = await periodEnd();
    const result = await callCallback('AUTH-2000', false);
    expect(result).toMatchObject({ paid: false });
    expect(await periodEnd()).toBe(before);

    const rows = await db.query<{ status: string }>(
      `select status from public.subscription_payments where provider_ref = 'AUTH-2000'`,
    );
    expect(rows.rows[0]?.status).toBe('failed');
  });

  it('a later successful delivery of the same reference pays exactly once', async () => {
    const before = await periodEnd();
    const result = await callCallback('AUTH-2000', true);
    expect(result).toMatchObject({ paid: true });
    const after = await periodEnd();
    expect(Date.parse(after)).toBeGreaterThan(Date.parse(before));

    // and a third replay changes nothing
    const replay = await callCallback('AUTH-2000', true);
    expect(replay).toMatchObject({ idempotent: true, paid: true });
    expect(await periodEnd()).toBe(after);
  });

  it('a replayed reference cannot pay a different subscription', async () => {
    const other = '00000000-0000-0000-0000-000000000061';
    await asSuper(db);
    await db.query(
      `insert into public.subscriptions (id, user_id, plan_id, status, period_end)
       select $1, $2, pl.id, 'pending', now() + interval '1 month'
       from public.subscription_plans pl where pl.code = 'basic'`,
      [other, IDS.carol],
    );
    const result = await callCallback('AUTH-1000', true, other);
    expect(result).toMatchObject({ idempotent: true, paid: true });

    const status = await db.query<{ status: string }>(
      `select status from public.subscriptions where id = $1`,
      [other],
    );
    expect(status.rows[0]?.status).toBe('pending'); // never activated by the replay
  });

  it('the callback RPC is callable by the server (anon + service role) and the ledger is private', async () => {
    await asAnonymous(db);
    const r = await db.query<{ apply_payment_result: Record<string, unknown> }>(
      `select public.apply_payment_result('zarinpal', 'AUTH-3000', $1, 8000000, false, null)`,
      [DAVE_SUB],
    );
    expect(r.rows[0]?.apply_payment_result).toMatchObject({ paid: false });

    const ledger = await db.query(`select id from public.subscription_payments`);
    expect(ledger.rows).toHaveLength(0); // anon sees nothing

    await asUser(db, IDS.dave);
    const mine = await db.query(`select provider_ref from public.subscription_payments order by provider_ref`);
    const refs = mine.rows.map((x) => (x as { provider_ref: string }).provider_ref);
    expect(refs).toContain('AUTH-1000');
    expect(refs).toContain('AUTH-2000');
    expect(refs).toContain('AUTH-3000');

    await asUser(db, IDS.alice);
    const strangers = await db.query(`select id from public.subscription_payments`);
    expect(strangers.rows).toHaveLength(0);
  });

  it('amount and provider are recorded verbatim for reconciliation', async () => {
    await asUser(db, IDS.dave);
    const r = await db.query<{ amount_irr: string; provider: string }>(
      `select amount_irr, provider from public.subscription_payments where provider_ref = 'AUTH-1000'`,
    );
    expect(String(r.rows[0]?.amount_irr)).toBe('8000000');
    expect(r.rows[0]?.provider).toBe('zarinpal');
  });
});
