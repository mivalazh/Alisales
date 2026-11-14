import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { IDS, asAnonymous, asSuper, asUser, createDb, expectError } from './helpers/pg';

/**
 * Migration 0009 — durable profiles and follows.
 *
 * Covers the hosted shape directly: one profile row per account, public reads,
 * owner-only writes, enum and length guards, and a public follower graph with
 * unique pairs and no self-follows.
 */
let db: PGlite;

beforeAll(async () => {
  db = await createDb();
  await asSuper(db);
});

afterAll(async () => {
  await db?.close();
});

describe('0009 profile_customizations', () => {
  it('stores the business profile fields and exposes them publicly', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.profile_customizations
         (user_id, bio, avatar_url, cover_url, profile_mode, business_type)
       values ($1, 'نمایشگاه خودروهای وارداتی کیش', 'https://cdn.example/avatar.webp',
               'https://cdn.example/cover.webp', 'business', 'car-dealer')`,
      [IDS.alice],
    );

    await asAnonymous(db);
    const publicRow = await db.query<{
      bio: string;
      profile_mode: string;
      business_type: string;
    }>(
      `select bio, profile_mode, business_type
       from public.profile_customizations where user_id = $1`,
      [IDS.alice],
    );
    expect(publicRow.rows[0]).toEqual({
      bio: 'نمایشگاه خودروهای وارداتی کیش',
      profile_mode: 'business',
      business_type: 'car-dealer',
    });
  });

  it('allows only the owner to update the row', async () => {
    await asUser(db, IDS.bob);
    const stranger = await db.query(
      `update public.profile_customizations set bio = 'not mine'
       where user_id = $1 returning user_id`,
      [IDS.alice],
    );
    expect(stranger.rows).toHaveLength(0);

    await asUser(db, IDS.alice);
    const owner = await db.query<{ bio: string }>(
      `update public.profile_customizations set bio = 'به‌روزرسانی شد'
       where user_id = $1 returning bio`,
      [IDS.alice],
    );
    expect(owner.rows[0]!.bio).toBe('به‌روزرسانی شد');
  });

  it('rejects unknown profile modes, business types and oversized bio', async () => {
    await asSuper(db);
    await expectError(
      db.query(
        `insert into public.profile_customizations (user_id, profile_mode)
         values ($1, 'dealer')`,
        [IDS.bob],
      ),
      'profile_customizations_profile_mode_check',
    );
    await expectError(
      db.query(
        `insert into public.profile_customizations (user_id, business_type)
         values ($1, 'spaceship')`,
        [IDS.bob],
      ),
      'profile_customizations_business_type_check',
    );
    await expectError(
      db.query(
        `insert into public.profile_customizations (user_id, bio)
         values ($1, repeat('x', 401))`,
        [IDS.bob],
      ),
      'profile_customizations_bio_check',
    );
  });
});

describe('0009 seller_follows', () => {
  it('stores a follow and serves the follower count publicly', async () => {
    await asSuper(db);
    await db.query(
      `insert into public.seller_follows (follower_id, seller_id)
       values ($1, $2)`,
      [IDS.alice, IDS.bob],
    );

    await asAnonymous(db);
    const rows = await db.query<{ follower_id: string; seller_id: string }>(
      `select follower_id, seller_id from public.seller_follows where seller_id = $1`,
      [IDS.bob],
    );
    expect(rows.rows).toEqual([{ follower_id: IDS.alice, seller_id: IDS.bob }]);
  });

  it('rejects duplicate pairs, self-follows and deletes by another user', async () => {
    await asSuper(db);
    await expectError(
      db.query(
        `insert into public.seller_follows (follower_id, seller_id)
         values ($1, $2)`,
        [IDS.alice, IDS.bob],
      ),
      'duplicate key',
    );
    await expectError(
      db.query(
        `insert into public.seller_follows (follower_id, seller_id)
         values ($1, $1)`,
        [IDS.alice],
      ),
      'seller_follows_check',
    );

    await asUser(db, IDS.bob);
    const stranger = await db.query(
      `delete from public.seller_follows where follower_id = $1 returning id`,
      [IDS.alice],
    );
    expect(stranger.rows).toHaveLength(0);

    await asUser(db, IDS.alice);
    const owner = await db.query(
      `delete from public.seller_follows where follower_id = $1 and seller_id = $2 returning id`,
      [IDS.alice, IDS.bob],
    );
    expect(owner.rows).toHaveLength(1);
  });
});
