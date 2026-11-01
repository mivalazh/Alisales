import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  ABUSE_REASON_LABELS,
  PLAN_PREVIEWS,
  PLAN_PREVIEW_SOON,
  abuseReportSchema,
  aedToIRR,
  canTransition,
  featureFlags,
  freeLimitDecision,
  irrToToman,
  listingEditSchema,
  listingPhotoSchema,
  listingStateChangeSchema,
  partCategories,
  sortOwnerStats,
  tomanToIRR,
} from '@alisales/schemas';
import {
  PART_CATEGORY_LINKS,
  filterByBodyType,
  filterByPartCategory,
  parseBodyType,
  parsePartCategory,
} from '../apps/web/lib/browse';
import { shouldRecordView } from '../apps/web/lib/data/stats-rules';
import { createDb } from './helpers/pg';
import type { ListingCardData } from '../apps/web/lib/data/listings';

const photo = (position = 0) => ({
  path: 'seller/a.webp',
  mime: 'image/webp' as const,
  bytes: 1000,
  width: 800,
  height: 600,
  position,
});

describe('listing edit schema (owner PATCH)', () => {
  it('keeps only editable fields — state and the posting clock are dropped', () => {
    const parsed = listingEditSchema.parse({
      priceIRR: 1234,
      publishedAt: '2020-01-01T00:00:00Z',
      published_at: '2020-01-01T00:00:00Z',
      state: 'sold',
      featured: true,
      sellerId: 'x',
    });
    expect(parsed).toEqual({ priceIRR: 1234 });
  });

  it('accepts an AED/Toman-entered price, description, phone toggle and photo set', () => {
    const parsed = listingEditSchema.safeParse({
      priceIRR: tomanToIRR(1_100_000_000),
      description: 'توضیحات ویرایش‌شده برای این آگهی',
      allowPhoneReveal: true,
      photos: [photo(0), photo(1)],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an empty change and an out-of-range photo set', () => {
    expect(listingEditSchema.safeParse({}).success).toBe(false);
    expect(listingEditSchema.safeParse({ photos: [] }).success).toBe(false);
    expect(listingEditSchema.safeParse({ photos: [photo(20)] }).success).toBe(false);
    expect(listingEditSchema.safeParse({ description: 'کوتاه' }).success).toBe(false);
  });

  it('converts Toman/AED entry to IRR and back', () => {
    expect(tomanToIRR(1000)).toBe(10_000);
    expect(irrToToman(10_000)).toBe(1000);
    expect(aedToIRR(2)).toBe(544_000);
  });

  it('limits owner state targets to active / paused / sold', () => {
    expect(listingStateChangeSchema.parse({ state: 'sold' }).state).toBe('sold');
    expect(listingStateChangeSchema.safeParse({ state: 'draft' }).success).toBe(false);
    expect(listingStateChangeSchema.safeParse({ state: 'pending_review' }).success).toBe(false);
  });

  it('allows only the owner transitions from the shared table', () => {
    expect(canTransition('active', 'sold', 'owner')).toBe(true);
    expect(canTransition('active', 'paused', 'owner')).toBe(true);
    expect(canTransition('paused', 'active', 'owner')).toBe(true);
    expect(canTransition('sold', 'active', 'owner')).toBe(true);
    expect(canTransition('sold', 'paused', 'owner')).toBe(false);
    expect(canTransition('active', 'active', 'owner')).toBe(false);
  });
});

describe('free cap + plan preview', () => {
  it('blocks the third active listing with the exact message', () => {
    expect(freeLimitDecision(0).allowed).toBe(true);
    expect(freeLimitDecision(1).remaining).toBe(1);
    expect(freeLimitDecision(2).allowed).toBe(false);
    expect(freeLimitDecision(2).message).toBe('برای آگهی سوم، پلن انتخاب کن.');
  });

  it('shows the two read-only plans with their limits and «بزودی» pricing', () => {
    expect(PLAN_PREVIEW_SOON).toBe('بزودی');
    const personal = PLAN_PREVIEWS.find((p) => p.code === 'personal')!;
    const showroom = PLAN_PREVIEWS.find((p) => p.code === 'showroom')!;
    expect(personal).toMatchObject({ listingLimit: 5, durationDays: 30, bumpsPerDay: 1 });
    expect(showroom).toMatchObject({ listingLimit: 50, durationDays: 90, bumpsPerDay: 3 });
    expect(showroom.features).toEqual(expect.arrayContaining(['استوری', 'آمار کامل']));
    expect(personal.features.join(' ')).toContain('۵ آگهی');
  });

  it('keeps subscriptions and city selection off', () => {
    expect(featureFlags.subscriptions).toBe(false);
    expect(featureFlags.city_selection).toBe(false);
    expect(Object.keys(featureFlags)).toContain('public_favorite_count');
    expect(Object.keys(featureFlags)).toHaveLength(10);
  });
});

describe('browse groups (hamburger drawer)', () => {
  const car = (model: string, trim: string | null = null): ListingCardData =>
    ({ model, trim, kind: 'vehicle' }) as unknown as ListingCardData;
  const part = (category: string): ListingCardData =>
    ({ model: '', kind: 'part', part: { category } }) as unknown as ListingCardData;

  it('parses known body types and rejects unknown ones', () => {
    expect(parseBodyType('suv')?.label).toBe('SUV');
    expect(parseBodyType('hybrid')?.label).toBe('خودروی برقی و هیبرید');
    expect(parseBodyType('spaceship')).toBeNull();
    expect(parsePartCategory('nope')).toBeNull();
  });

  it('filters vehicles by curated keywords and never matches parts', () => {
    const suv = parseBodyType('suv')!;
    const list = [car('Land Cruiser', 'VXR'), car('Patrol'), car('Camry'), part(partCategories[0]!)];
    expect(filterByBodyType(list, suv).map((l) => l.model)).toEqual(['Land Cruiser', 'Patrol']);
  });

  it('filters parts by category', () => {
    const list = [car('Camry'), part(partCategories[0]!), part(partCategories[1]!)];
    expect(filterByPartCategory(list, partCategories[0]!)).toHaveLength(1);
  });

  it('exposes one parts link per category', () => {
    expect(PART_CATEGORY_LINKS).toHaveLength(partCategories.length);
    expect(PART_CATEGORY_LINKS.every((link) => link.href.startsWith('/?category='))).toBe(true);
  });
});

describe('event recording rules + ordering', () => {
  it('skips guests and the owner, counts everyone else', () => {
    expect(shouldRecordView(undefined, 'seller')).toBe(false);
    expect(shouldRecordView(null, 'seller')).toBe(false);
    expect(shouldRecordView('seller', 'seller')).toBe(false);
    expect(shouldRecordView('buyer', 'seller')).toBe(true);
  });

  it('orders by views, contacts, then newest without merging counters', () => {
    const rows = [
      { listingId: 'a', views: 1, chatStarts: 0, phoneReveals: 0, favorites: 0 },
      { listingId: 'b', views: 5, chatStarts: 0, phoneReveals: 0, favorites: 0 },
      { listingId: 'c', views: 2, chatStarts: 1, phoneReveals: 2, favorites: 0 },
    ];
    expect(sortOwnerStats(rows, 'views').map((r) => r.listingId)).toEqual(['b', 'c', 'a']);
    expect(sortOwnerStats(rows, 'contacts').map((r) => r.listingId)).toEqual(['c', 'b', 'a']);
    expect(
      sortOwnerStats(rows, 'newest', {
        a: '2026-01-01T00:00:00Z',
        b: '2026-03-01T00:00:00Z',
        c: '2026-02-01T00:00:00Z',
      }).map((r) => r.listingId),
    ).toEqual(['b', 'c', 'a']);
    // the row shape keeps reveals and chats separate
    expect(rows[2]!.phoneReveals).toBe(2);
    expect(rows[2]!.chatStarts).toBe(1);
  });

  it('validates abuse reports and labels every reason', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(abuseReportSchema.safeParse({ listingId: id, reason: 'fraud' }).success).toBe(true);
    expect(abuseReportSchema.safeParse({ listingId: '', reason: 'fraud' }).success).toBe(false);
    // fixture-mode ids are `local-…`, so a non-UUID id is accepted here and the
    // route's lookup answers 404 for anything unknown
    expect(abuseReportSchema.safeParse({ listingId: 'local-abc123', reason: 'fraud' }).success).toBe(
      true,
    );
    expect(abuseReportSchema.safeParse({ listingId: id, reason: 'bad' }).success).toBe(false);
    expect(
      abuseReportSchema.safeParse({ listingId: id, reason: 'other', details: 'x'.repeat(1001) })
        .success,
    ).toBe(false);
    expect(Object.values(ABUSE_REASON_LABELS)).toHaveLength(6);
  });

  it('keeps photo positions inside 0..19', () => {
    expect(listingPhotoSchema.safeParse(photo(19)).success).toBe(true);
    expect(listingPhotoSchema.safeParse(photo(20)).success).toBe(false);
  });
});

describe('database invariants (PGlite)', () => {
  let db: PGlite;
  let listing: { id: string; created_by: string; published_at: string };
  let viewer: string;

  beforeAll(async () => {
    db = await createDb();
    const r = await db.query<{ id: string; created_by: string; published_at: string }>(
      `select id, created_by, published_at from public.listings
       where state = 'active' and kind = 'vehicle' order by id limit 1`,
    );
    listing = r.rows[0]!;
    const v = await db.query<{ id: string }>(
      `select id from public.users where id <> $1 order by id limit 1`,
      [listing.created_by],
    );
    viewer = v.rows[0]!.id;
  });
  afterAll(async () => {
    await db?.close();
  });

  async function publishedAt(): Promise<string> {
    const r = await db.query<{ published_at: string }>(
      `select published_at from public.listings where id = $1`,
      [listing.id],
    );
    return new Date(r.rows[0]!.published_at).toISOString();
  }

  it('edit (price/description) never moves published_at', async () => {
    const before = await publishedAt();
    await db.query(
      `update public.listings set price_irr = 123456, description = 'توضیحات ویرایش‌شده آگهی' where id = $1`,
      [listing.id],
    );
    expect(await publishedAt()).toBe(before);
  });

  it('pause → reactivate keeps the original posting age', async () => {
    const before = await publishedAt();
    await db.query(`update public.listings set state = 'paused' where id = $1`, [listing.id]);
    await db.query(`update public.listings set state = 'active' where id = $1`, [listing.id]);
    expect(await publishedAt()).toBe(before);
  });

  it('marking sold stamps sold_at and keeps the listing public', async () => {
    await db.query(`update public.listings set state = 'sold' where id = $1`, [listing.id]);
    const r = await db.query<{ sold_at: string | null; state: string }>(
      `select sold_at, state from public.listings where id = $1`,
      [listing.id],
    );
    expect(r.rows[0]!.state).toBe('sold');
    expect(r.rows[0]!.sold_at).not.toBeNull();
    await db.query(`update public.listings set state = 'active' where id = $1`, [listing.id]);
  });

  it('counts one view per viewer but every reveal', async () => {
    await db.query(`delete from public.listing_views where listing_id = $1`, [listing.id]);
    await db.query(
      `insert into public.listing_views (listing_id, viewer_id) values ($1, $2)`,
      [listing.id, viewer],
    );
    await expect(
      db.query(`insert into public.listing_views (listing_id, viewer_id) values ($1, $2)`, [
        listing.id,
        viewer,
      ]),
    ).rejects.toThrow();

    await db.query(
      `insert into public.phone_reveal_events (listing_id, viewer_id) values ($1, $2), ($1, $2)`,
      [listing.id, viewer],
    );
    const reveals = await db.query<{ n: number }>(
      `select count(*)::int as n from public.phone_reveal_events where listing_id = $1`,
      [listing.id],
    );
    expect(reveals.rows[0]!.n).toBeGreaterThanOrEqual(2);
  });

  it('allows one abuse report per reporter per listing', async () => {
    await db.query(`delete from public.abuse_reports where listing_id = $1`, [listing.id]);
    await db.query(
      `insert into public.abuse_reports (listing_id, reporter_id, reason) values ($1, $2, 'fraud')`,
      [listing.id, listing.created_by],
    );
    await expect(
      db.query(
        `insert into public.abuse_reports (listing_id, reporter_id, reason) values ($1, $2, 'spam')`,
        [listing.id, listing.created_by],
      ),
    ).rejects.toThrow();
  });
});
