-- ============================================================================
-- 0020 — Keyset pagination for the public catalogue.
--
-- `search_listings` (0017) answers one OFFSET page and its callers walk the
-- whole pool: the route pages 100 rows at a time until a short page, up to
-- 1 000 rows per response. That is O(offset) work in the database for every
-- request — page 5 re-reads and discards pages 1–4 — and it makes the response
-- size grow with the catalogue instead of with what the buyer scrolled.
--
-- This adds the paged read beside it, not instead of it:
--
--   search_listings_page(p_filters, p_limit, p_cursor)
--     → rows jsonb, next_cursor text
--
-- It returns one page of `public.listing_cards`, in the exact ranking 0017
-- uses, plus the cursor for the next page (`null` on the last page). There is
-- no `count(*)`: the answer carries whether another page exists, not how many
-- rows the filter matches. That is what "limit + 1" buys — one extra row is
-- read to answer `hasMore`, and the extra row is dropped before the response.
--
-- The cursor is opaque (base64 JSON) and bound to the filter set: it carries
-- `md5(p_filters::text)`, so presenting a cursor from another filter set raises
-- instead of silently skipping or repeating rows. `jsonb`'s text form is
-- canonical (keys sorted), so the hash is stable for equivalent payloads.
--
-- `search_listings` is untouched: the prerender, the pool walk for curated
-- extras narrowing and the mobile app still call it.
-- ============================================================================

-- ── Indexes ────────────────────────────────────────────────────────────────
--
-- The page ORDER is (sold last, featured, search_priority, published_at desc,
-- created_at desc, id desc). `search_priority` is computed by listing_cards
-- from the showroom's active plan, so it cannot be indexed on the view; the
-- index below serves the base scan and the keyset's last three tiebreakers,
-- and the visibility predicate (`is_listing_public`) still prunes first.
create index if not exists listings_page_order_idx
  on public.listings (published_at desc, created_at desc, id desc)
  where state in ('active', 'sold');

-- The filters that actually narrow a page. Each index mirrors a predicate; a
-- filter without one still works, it just scans the visible set.
create index if not exists listings_city_state_idx
  on public.listings (city, state);
create index if not exists listings_price_idx
  on public.listings (price_irr)
  where state = 'active';
create index if not exists vehicles_category_body_idx
  on public.vehicles (category, body_type);
create index if not exists vehicles_year_idx
  on public.vehicles (year);
create index if not exists vehicles_mileage_idx
  on public.vehicles (mileage_km);

-- ── The paged read ─────────────────────────────────────────────────────────
create or replace function public.search_listings_page(
  p_filters jsonb default '{}'::jsonb,
  p_limit int default 24,
  p_cursor text default null
) returns table (rows jsonb, next_cursor text)
language plpgsql stable security definer set search_path = public, pg_temp as $fn$
declare
  v_brand text := nullif(p_filters ->> 'brand', '');
  v_model text := nullif(p_filters ->> 'model', '');
  v_trim text := nullif(p_filters ->> 'trim', '');
  v_year_from int := nullif(p_filters ->> 'yearFrom', '')::int;
  v_year_to int := nullif(p_filters ->> 'yearTo', '')::int;
  v_price_from bigint := nullif(p_filters ->> 'priceFrom', '')::bigint;
  v_price_to bigint := nullif(p_filters ->> 'priceTo', '')::bigint;
  v_mileage_min int := nullif(p_filters ->> 'mileageMin', '')::int;
  v_mileage_max int := nullif(p_filters ->> 'mileageMax', '')::int;
  v_gearbox text := nullif(p_filters ->> 'gearbox', '');
  v_fuel text := nullif(p_filters ->> 'fuel', '');
  v_plate text := nullif(p_filters ->> 'plateType', '');
  v_condition text := nullif(p_filters ->> 'condition', '');
  v_city text := nullif(p_filters ->> 'city', '');
  v_body text := nullif(p_filters ->> 'bodyType', '');
  v_category text := nullif(p_filters ->> 'category', '');
  v_bike text := nullif(p_filters ->> 'bikeType', '');
  v_heavy text := nullif(p_filters ->> 'heavyType', '');
  v_engine_min int := nullif(p_filters ->> 'engineCcMin', '')::int;
  v_engine_max int := nullif(p_filters ->> 'engineCcMax', '')::int;
  v_hours_max int := nullif(p_filters ->> 'workingHoursMax', '')::int;
  v_insurance text := nullif(p_filters ->> 'insurance', '');
  v_paint text := nullif(p_filters ->> 'paintCondition', '');
  v_chassis text := nullif(p_filters ->> 'chassisCondition', '');
  v_inspection text := nullif(p_filters ->> 'technicalInspection', '');
  v_has_report boolean := case when (p_filters ->> 'hasReport') = 'true' then true else null end;
  v_q text := nullif(p_filters ->> 'q', '');
  v_kish boolean := coalesce((p_filters ->> 'kishOnly')::boolean, false);

  v_hash text := md5(coalesce(p_filters, '{}'::jsonb)::text);
  v_limit int := greatest(1, least(coalesce(p_limit, 24), 100));
  v_cursor jsonb;

  -- Sort keys of the cursor row. All ascending except the timestamps, which are
  -- stored as epochs and compared with `desc` (a total order, nulls folded into
  -- a sentinel far in the past instead of Postgres' `nulls last`).
  c_k1 int;
  c_k2 int;
  c_k3 int;
  c_k4 double precision;
  c_k5 double precision;
  c_k6 text;
begin
  if p_cursor is not null then
    begin
      v_cursor := convert_from(decode(p_cursor, 'base64'), 'utf8')::jsonb;
    exception when others then
      raise exception 'malformed pagination cursor' using errcode = '22023';
    end;
    if (v_cursor ->> 'h') is distinct from v_hash then
      raise exception 'pagination cursor does not belong to this filter set'
        using errcode = '22023';
    end if;
    c_k1 := (v_cursor ->> 'k1')::int;
    c_k2 := (v_cursor ->> 'k2')::int;
    c_k3 := (v_cursor ->> 'k3')::int;
    c_k4 := (v_cursor ->> 'k4')::double precision;
    c_k5 := (v_cursor ->> 'k5')::double precision;
    c_k6 := v_cursor ->> 'k6';
  end if;

  return query
  with filtered as (
    select
      c.*,
      -- The ranking from 0017, turned into comparable sort keys.
      (c.state = 'sold')::int as k1,
      (c.featured is not true)::int as k2,
      -coalesce(c.search_priority, 0) as k3,
      coalesce(extract(epoch from c.published_at), -8.64e13)::double precision as k4,
      extract(epoch from c.created_at)::double precision as k5,
      c.id::text as k6
    from public.listing_cards c
    where public.is_listing_public(c.id)
      and (not v_kish or c.city = 'kish')
      and (v_brand is null or c.brand = any (string_to_array(v_brand, ',')))
      and (v_model is null or c.model ilike '%' || v_model || '%')
      and (v_trim is null or coalesce(c.trim, '') ilike '%' || v_trim || '%')
      and (v_year_from is null or c.year >= v_year_from)
      and (v_year_to is null or c.year <= v_year_to)
      and (v_price_from is null or c.price_irr >= v_price_from)
      and (v_price_to is null or c.price_irr <= v_price_to)
      and (v_mileage_min is null or c.mileage_km >= v_mileage_min)
      and (v_mileage_max is null or c.mileage_km <= v_mileage_max)
      and (v_gearbox is null or c.gearbox::text = any (string_to_array(v_gearbox, ',')))
      and (v_fuel is null or c.fuel::text = any (string_to_array(v_fuel, ',')))
      and (v_plate is null or c.plate_type::text = any (string_to_array(v_plate, ',')))
      and (v_condition is null or c.condition::text = any (string_to_array(v_condition, ',')))
      and (v_city is null or c.city = any (string_to_array(v_city, ',')))
      and (v_category is null or c.category = v_category)
      and (v_body is null or c.body_type = any (string_to_array(v_body, ',')))
      and (v_bike is null
           or c.category is distinct from 'motorcycle'
           or c.bike_type = any (string_to_array(v_bike, ',')))
      and (v_heavy is null
           or c.category is distinct from 'heavy'
           or c.heavy_type = any (string_to_array(v_heavy, ',')))
      and (v_engine_min is null
           or c.category is distinct from 'motorcycle'
           or coalesce(c.engine_cc, 0) >= v_engine_min)
      and (v_engine_max is null
           or c.category is distinct from 'motorcycle'
           or coalesce(c.engine_cc, 0) <= v_engine_max)
      and (v_hours_max is null
           or c.category is distinct from 'heavy'
           or coalesce(c.working_hours, 0) <= v_hours_max)
      and (v_insurance is null
           or not ('third_party' = any (string_to_array(v_insurance, ',')))
           or c.third_party_insurance is true)
      and (v_insurance is null
           or not ('body' = any (string_to_array(v_insurance, ',')))
           or c.body_insurance is true)
      and (v_paint is null or c.paint_condition = any (string_to_array(v_paint, ',')))
      and (v_chassis is null or c.chassis_condition = any (string_to_array(v_chassis, ',')))
      and (v_inspection is null
           or (v_inspection = 'yes' and c.technical_inspection is true)
           or (v_inspection = 'no' and c.technical_inspection is false))
      and (v_has_report is null or (v_has_report and c.has_report))
      and (v_q is null
           or c.model ilike '%' || v_q || '%'
           or c.description ilike '%' || v_q || '%'
           or c.brand ilike '%' || v_q || '%')
  ),
  paged as (
    select f.*
    from filtered f
    -- One row of the page is discarded by the caller; asking for it here also
    -- separates "this is the last page" from "there is exactly one more row",
    -- so a full page with nothing after it never advertises a next page.
    where p_cursor is null
       or f.k1 > c_k1
       or (f.k1 = c_k1 and f.k2 > c_k2)
       or (f.k1 = c_k1 and f.k2 = c_k2 and f.k3 > c_k3)
       or (f.k1 = c_k1 and f.k2 = c_k2 and f.k3 = c_k3 and f.k4 < c_k4)
       or (f.k1 = c_k1 and f.k2 = c_k2 and f.k3 = c_k3 and f.k4 = c_k4 and f.k5 < c_k5)
       or (f.k1 = c_k1 and f.k2 = c_k2 and f.k3 = c_k3 and f.k4 = c_k4
           and f.k5 = c_k5 and f.k6 < c_k6)
    order by f.k1, f.k2, f.k3, f.k4 desc, f.k5 desc, f.k6 desc
    limit v_limit + 1
  ),
  kept as (
    select * from paged
    order by k1, k2, k3, k4 desc, k5 desc, k6 desc
    limit v_limit
  ),
  last_row as (
    select * from kept
    order by k1 desc, k2 desc, k3 desc, k4, k5, k6
    limit 1
  )
  select
    -- The sort keys are the cursor's business only; a card must look exactly
    -- like a `search_listings` row.
    coalesce(
      (
        select jsonb_agg(
          to_jsonb(k) - 'k1' - 'k2' - 'k3' - 'k4' - 'k5' - 'k6'
          order by k.k1, k.k2, k.k3, k.k4 desc, k.k5 desc, k.k6 desc
        )
        from kept k
      ),
      '[]'::jsonb
    ),
    case
      when (select count(*) from paged) > v_limit then
        encode(
          convert_to(
            jsonb_build_object(
              'h', v_hash,
              'k1', l.k1,
              'k2', l.k2,
              'k3', l.k3,
              'k4', l.k4,
              'k5', l.k5,
              'k6', l.k6
            )::text,
            'utf8'
          ),
          'base64'
        )
      else null
    end
  -- `last_row` is empty on the last page; the join keeps the single result row
  -- (an empty `rows` array, a null cursor) instead of returning no row at all.
  from (select 1) as one
  left join last_row l on true;
end
$fn$;

comment on function public.search_listings_page(jsonb, int, text) is
  'Keyset page of the public catalogue: same filters and ranking as search_listings, one page plus the cursor for the next (filter-hash bound, limit+1 hasMore, no count).';
