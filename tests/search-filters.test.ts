import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asAnonymous, asUser, createDb } from './helpers/pg';

let db: PGlite;

beforeAll(async () => {
  db = await createDb();
});
afterAll(async () => {
  await db?.close();
});

async function search(filters: Record<string, unknown>, limit = 50): Promise<string[]> {
  const r = await db.query<{ slug: string }>(
    `select slug from public.search_listings($1::jsonb, $2)`,
    [JSON.stringify(filters), limit],
  );
  return r.rows.map((x) => x.slug);
}

describe('search_listings RPC (single filter implementation)', () => {
  it('returns only public listings by default', async () => {
    const slugs = await search({});
    expect(slugs).toHaveLength(7);
    expect(slugs).not.toContain('dena-plus-sold');
    expect(slugs).not.toContain('tiba-alice-draft');
    expect(slugs).not.toContain('samaned-hidden');
  });

  it('ranks featured first, then plan search priority, then recency', async () => {
    const slugs = await search({});
    expect(slugs[0]).toBe('peugeot-206-showroom'); // featured + report
    // showroom (Basic, priority 1) listings precede the individual's (priority 0)
    expect(slugs.indexOf('kiaqi-kish-showroom')).toBeLessThan(
      slugs.indexOf('peugeot-206-alice'),
    );
  });

  it('filters Kish-only', async () => {
    const slugs = await search({ kishOnly: true });
    expect(slugs).toContain('kiaqi-kish-showroom');
    expect(slugs).toContain('peugeot-206-alice');
    expect(slugs).not.toContain('shahin-new-tehran');
  });

  it('filters by brand and multi-brand csv', async () => {
    expect((await search({ brand: 'saipa' })).sort()).toEqual(
      ['kiaqi-kish-showroom', 'kioqi-transit', 'shahin-new-tehran'].sort(),
    );
    expect(await search({ brand: 'saipa,ikco' })).toHaveLength(7);
  });

  it('filters by model substring and quick search text', async () => {
    expect(await search({ model: '۲۰۶' })).toHaveLength(4);
    expect(await search({ q: 'کوییک' })).toHaveLength(2);
  });

  it('filters by year range, price range and mileage', async () => {
    expect(await search({ yearFrom: 1403 })).toEqual(['shahin-new-tehran']);
    expect(await search({ yearTo: 1399 })).toEqual(['peugeot-206-alice']);
    expect(await search({ priceFrom: 1_000_000_000_000 })).toHaveLength(5);
    expect(await search({ priceTo: 900_000_000_000 }).then((s) => s.sort())).toEqual(
      ['kiaqi-kish-showroom', 'kioqi-transit'].sort(),
    );
    expect(await search({ mileageMax: 50_000 })).toHaveLength(3);
  });

  it('filters by gearbox, plate type, condition and city', async () => {
    expect(await search({ gearbox: 'automatic' })).toEqual(['shahin-new-tehran']);
    expect(await search({ plateType: 'kish' })).toHaveLength(3);
    expect(await search({ condition: 'new' })).toEqual(['shahin-new-tehran']);
    expect(await search({ city: 'tehran' })).toHaveLength(2);
  });

  it('filters by hasReport', async () => {
    expect(await search({ hasReport: true })).toEqual(['peugeot-206-showroom']);
  });

  it('combines filters conjunctively', async () => {
    const slugs = await search({ brand: 'saipa', plateType: 'temporary_transit', kishOnly: true });
    expect(slugs).toEqual(['kioqi-transit']);
  });

  it('an impossible range returns zero rows', async () => {
    expect(await search({ yearFrom: 1403, yearTo: 1390 })).toHaveLength(0);
  });

  it('paginates', async () => {
    const page1 = await search({}, 3);
    const page2 = await db.query<{ slug: string }>(
      `select slug from public.search_listings('{}'::jsonb, 3, 3)`,
    );
    expect(page1).toHaveLength(3);
    expect(page2.rows).toHaveLength(3);
    expect(page1.some((s) => page2.rows.map((r) => r.slug).includes(s))).toBe(false);
  });

  it('gives identical results to anonymous visitors and signed-in users', async () => {
    await asAnonymous(db);
    const anon = await search({ kishOnly: true });
    await asUser(db, '00000000-0000-0000-0000-00000000000c');
    const authed = await search({ kishOnly: true });
    expect(authed).toEqual(anon);
  });
});
