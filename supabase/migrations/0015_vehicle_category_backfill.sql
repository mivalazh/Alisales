-- ============================================================================
-- 0015 — Route pre-0014 hosted rows to their own category page.
--
-- 0014 added `vehicles.category` as `not null default 'car'`, so every row
-- written before it reads as a car — including hosted motorcycles and heavy
-- machinery. Those categories are the only ones whose brand slugs carry the
-- `bike-` / `heavy-` prefix (packages/schemas/src/categories.ts has 15 and 14
-- of them, and no car marque is prefixed), so the brand alone recovers the
-- category a row was published under. Without this backfill a migrated
-- database keeps /motorcycles and /heavy empty until every seller republishes.
--
-- Additive and idempotent: only rows still sitting on the default move, so a
-- row that already carries its own category is never touched, and running this
-- again changes nothing. A backfilled row has no stored body class,
-- displacement, bike/heavy class or working hours; those stay null — unknown,
-- not zero — so the category-specific filters simply do not constrain it until
-- the seller fills them in.
-- ============================================================================

update public.vehicles
set category = 'motorcycle'
where category = 'car'
  and brand like 'bike-%';

update public.vehicles
set category = 'heavy'
where category = 'car'
  and brand like 'heavy-%';
