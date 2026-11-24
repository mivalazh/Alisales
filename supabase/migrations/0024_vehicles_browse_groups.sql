-- ============================================================================
-- 0024 — Prototype: a persisted `vehicles.browse_groups` with a GIN index.
--
-- Today `?body=suv` is a predicate over keyword `ilike` (0023): correct, but
-- O(rows) — no index can serve `model ilike '%land cruiser%'`, so a curated
-- chip scans the visible set and only then sorts. The other half of the table
-- is that the same keyword table already knows the answer at write time.
--
-- This is the alternative, as a prototype: store the curated chips a vehicle
-- belongs to (the keys of `CAR_BODY_GROUPS`, in drawer order) and let the chip
-- be one array containment test:
--
--   where browse_groups && array['suv']
--
-- which a GIN index answers without reading the row's model text.
--
--   derive : `browseGroupsFor(model, trim)` in `@alisales/schemas` — the same
--            haystack and matcher as `filterByBodyType` (model + trim,
--            `keywords ∪ browseOnly`), so the array and the browser agree.
--   write  : publish-store (web), the mobile insert/update, the seeds.
--   fill   : `scripts/backfill-browse-groups.ts` for rows written before this
--            column existed (a script, not a migration: the mapping is the
--            TypeScript table, and duplicating it in SQL is the drift 0022 had
--            to repair).
--
-- What this migration deliberately does NOT do:
--
--   - it does not change `search_listings_page` or `listing_cards`; the route
--     does not read the column yet, so a wrong derivation cannot reach a buyer
--     while the two approaches are being compared;
--   - it does not add a trigger to keep the column fresh: the writers own it,
--     exactly like `body_type`. A trigger would be the alternative once the
--     mobile app stops being the only writer we control.
--
-- `default '{}'` and `not null` make the column safe for old code that inserts
-- without it (an absent array is "no chips", not a null to branch on), and the
-- backfill then fills the rows that exist. `{}` is also the honest value for a
-- motorcycle, a machine or a part-adjacent vehicle: the chips are car classes.
-- ============================================================================

alter table public.vehicles
  add column if not exists browse_groups text[] not null default '{}';

-- The whole point of the prototype: containment on the array, no model text.
create index if not exists vehicles_browse_groups_idx
  on public.vehicles using gin (browse_groups);

comment on column public.vehicles.browse_groups is
  'Curated browse chips (CAR_BODY_GROUPS keys) the model/trim matches, in drawer order. Written by publish-store, mobile and the seeds; filled for old rows by scripts/backfill-browse-groups.ts. Empty for non-cars.';
comment on index public.vehicles_browse_groups_idx is
  'Serves `browse_groups && array[''suv'']` for a curated ?body= chip without scanning model text.';
