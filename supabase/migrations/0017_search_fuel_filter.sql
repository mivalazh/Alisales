-- ============================================================================
-- 0017 — Make the hosted search honour the fuel filter.
--
-- `fuel` is a real drawer filter (`FilterSystem.tsx`), it serialises into the
-- RPC payload, and the shared client predicate matches it — but no version of
-- `search_listings` ever had a `fuel` predicate (0002 and 0014 both omit it,
-- despite 0014's comment listing it). A hosted `/cars?fuel=hybrid` therefore
-- returned every fuel and the shell, trusting server rows, showed them.
--
-- Same function as 0014 with one declaration and one predicate added; every
-- other filter is unchanged, so this is the smallest edit that closes the gap.
-- ============================================================================

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
    and (v_fuel is null or c.fuel::text = any (string_to_array(v_fuel, ',')))
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
  'Public catalogue search — the single filter implementation for web and mobile (category, specs, condition facts since 0014; fuel since 0017).';
