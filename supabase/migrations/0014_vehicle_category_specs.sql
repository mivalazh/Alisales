-- ============================================================================
-- 0014 — Motorcycle / heavy-machinery specs and condition facts in the public
--        catalogue (vehicles → listing_cards → search_listings).
--
-- Until now a hosted vehicle could only be a car: `vehicles` had no category,
-- body class, displacement, bike/heavy class or working hours, so every hosted
-- row read back as `car` and /motorcycles and /heavy could only ever serve the
-- seeded catalogue. The seller-declared condition facts added in 0008 were
-- stored but deliberately left out of `listing_cards`, so a hosted filter on
-- them could never match either.
--
-- Additive only: every new column is defaulted or nullable, so existing rows
-- keep validating and read as cars, and the view appends its columns
-- (CREATE OR REPLACE VIEW may only append).
-- ============================================================================

-- ── 1) vehicles: category + category-specific specs ─────────────────────────
alter table public.vehicles
  add column if not exists category text not null default 'car',
  add column if not exists body_type text,
  add column if not exists engine_cc int,
  add column if not exists bike_type text,
  add column if not exists heavy_type text,
  add column if not exists working_hours int;

alter table public.vehicles
  add constraint vehicles_category_valid
    check (category in ('car', 'motorcycle', 'heavy')),
  add constraint vehicles_body_type_valid
    check (
      body_type is null
      or body_type in (
        'sedan', 'suv', 'coupe', 'convertible', 'hatchback', 'crossover', 'pickup', 'van'
      )
    ),
  add constraint vehicles_engine_cc_range
    check (engine_cc is null or engine_cc between 0 and 3000),
  add constraint vehicles_bike_type_valid
    check (
      bike_type is null
      or bike_type in (
        'scooter', 'electric', 'petrol_scooter', 'sport', 'cross', 'classic', 'touring'
      )
    ),
  add constraint vehicles_heavy_type_valid
    check (
      heavy_type is null
      or heavy_type in (
        'truck', 'tractor', 'trailer', 'excavator', 'loader', 'crane', 'dozer', 'mixer', 'other'
      )
    ),
  add constraint vehicles_working_hours_valid
    check (working_hours is null or working_hours between 0 and 500_000);

-- A bike displacement or a heavy class on a car row (or vice versa) is a data
-- bug, not a rendering detail: keep the category and its specs consistent.
alter table public.vehicles
  add constraint vehicles_category_specs check (
    (engine_cc is null or category = 'motorcycle')
    and (bike_type is null or category = 'motorcycle')
    and (heavy_type is null or category = 'heavy')
    and (working_hours is null or category = 'heavy')
  );

create index vehicles_category_idx on public.vehicles (category);
create index vehicles_category_bike_idx
  on public.vehicles (category, bike_type) where bike_type is not null;
create index vehicles_category_heavy_idx
  on public.vehicles (category, heavy_type) where heavy_type is not null;

comment on column public.vehicles.category is
  'car | motorcycle | heavy — the page a vehicle belongs to; default keeps legacy rows on /cars.';
comment on column public.vehicles.engine_cc is
  'Motorcycle displacement in cc; null for electric models and every other category.';
comment on column public.vehicles.working_hours is
  'Heavy machinery working hours (stands in for mileage on that page).';

-- ── 2) Public projection: expose the specs and the condition facts ──────────
-- Column list and order are identical to 0007; the new columns are appended.
-- `category` is the vehicle's own value (null for parts), so a category filter
-- in the RPC can never pull a part into /cars, /motorcycles or /heavy.
create or replace view public.listing_cards with (security_invoker = on) as
select
  l.id,
  l.slug,
  l.created_by as seller_id,
  l.price_irr,
  l.city,
  l.description,
  l.state,
  l.featured,
  l.published_at,
  l.created_at,
  l.allow_phone_reveal,
  l.price_anomaly,
  l.report_id,
  (l.report_id is not null) as has_report,
  coalesce(v.brand, '') as brand,
  coalesce(v.model, pd.title, '') as model,
  v.trim,
  coalesce(v.year, 0) as year,
  coalesce(v.mileage_km, 0) as mileage_km,
  coalesce(v.gearbox, 'automatic') as gearbox,
  coalesce(v.fuel, 'petrol') as fuel,
  coalesce(v.color, 'white') as color,
  coalesce(v.condition, 'used') as condition,
  coalesce(v.plate_type, 'unplated') as plate_type,
  cover.storage_path as cover_photo_path,
  coalesce(ep.search_priority, 0) as search_priority,
  s.name as showroom_name,
  s.slug as showroom_slug,
  s.is_verified as showroom_verified,
  l.kind,
  pd.title as part_title,
  pd.category as part_category,
  pd.origin as part_origin,
  pd.condition as part_condition,
  pd.part_number as part_number,
  pd.compatibility as part_compatibility,
  pd.warranty as part_warranty,
  -- New in 0014: category + specs, then the 0008 condition facts.
  v.category,
  v.body_type,
  v.engine_cc,
  v.bike_type,
  v.heavy_type,
  v.working_hours,
  v.third_party_insurance,
  v.third_party_months,
  v.body_insurance,
  v.body_months,
  v.paint_condition,
  v.chassis_condition,
  v.technical_inspection,
  v.is_journal_photo,
  v.inspection_sheet_url,
  v.inspection_note
from public.listings l
left join public.vehicles v on v.id = l.vehicle_id
left join public.part_details pd on pd.listing_id = l.id
left join public.showrooms s on s.id = l.showroom_id
left join lateral (
  select pl.search_priority
  from public.subscriptions sub
  join public.subscription_plans pl on pl.id = sub.plan_id
  where sub.showroom_id = l.showroom_id
    and sub.status = 'active' and sub.period_end > now() and pl.is_active
  order by pl.search_priority desc
  limit 1
) ep on true
left join lateral (
  select lp.storage_path
  from public.listing_photos lp
  where lp.listing_id = l.id
  order by lp.position
  limit 1
) cover on true;

grant select on public.listing_cards to anon, authenticated, service_role;

-- ── 3) The one search: every filter the web URL can express ─────────────────
-- Same filters as before (brand/model/trim/year/price/mileage/gearbox/fuel/
-- plate/condition/city/report/kish/q) plus the category, the body class, the
-- bike/heavy class, displacement, working hours and the condition facts — so a
-- hosted /motorcycles or /heavy request narrows in SQL instead of paging cars
-- over the wire and discarding them in the browser.
create or replace function public.search_listings(
  p_filters jsonb default '{}'::jsonb,
  p_limit int default 24,
  p_offset int default 0
) returns setof public.listing_cards
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
begin
  return query
  select c.*
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
    and (v_plate is null or c.plate_type::text = any (string_to_array(v_plate, ',')))
    and (v_condition is null or c.condition::text = any (string_to_array(v_condition, ',')))
    and (v_city is null or c.city = any (string_to_array(v_city, ',')))
    -- Category scope: a part has no category, so it never matches a page.
    and (v_category is null or c.category = v_category)
    and (v_body is null or c.body_type = any (string_to_array(v_body, ',')))
    -- Category-specific blocks only constrain their own category, exactly like
    -- the client predicate: a stale bike filter can never empty a car search.
    and (v_bike is null
         or c.category is distinct from 'motorcycle'
         or c.bike_type = any (string_to_array(v_bike, ',')))
    and (v_heavy is null
         or c.category is distinct from 'heavy'
         or c.heavy_type = any (string_to_array(v_heavy, ',')))
    -- Electric bikes have no displacement; like the client predicate they rank
    -- as 0 cc in a range filter instead of vanishing as unknown.
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
  order by (c.state = 'sold') asc,
           c.featured desc nulls last,
           c.search_priority desc,
           c.published_at desc nulls last,
           c.created_at desc,
           c.id desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
end
$fn$;

comment on function public.search_listings(jsonb, int, int) is
  'Public catalogue search — the single filter implementation for web and mobile (category, specs and condition facts included since 0014).';
