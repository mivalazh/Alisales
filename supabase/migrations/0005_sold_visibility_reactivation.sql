-- ============================================================================
-- 0005 — Sold listings: stay in the catalog, sort last, owner may reactivate
--
-- Product rules (Phase 2 / D2):
--   * A sold listing remains publicly visible in browse/search/detail with its
--     "فروخته‌شده/Sold" badge — buyers keep the price history and the seller's
--     credibility trail; the listing always ranks LAST (after every active one).
--   * The owner may reactivate it (sold → active): sold_at is cleared and the
--     normal active-entry refresh (published_at/expires_at/hidden_at) applies.
--   * A sold listing never yields a phone number, even when the seller opted
--     into phone reveal (allow_phone_reveal) — chat-only until reactivated.
--
-- All public read paths (listing_cards view, search_listings RPC, RLS select
-- policy) gate on is_listing_public(), so flipping that one function covers
-- browse, search and detail in every client.
-- ============================================================================

-- 1) Sold is public (still requires unhidden + live showroom subscription).
create or replace function public.is_listing_public(p_listing uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing
      and l.state in ('active', 'sold')
      and l.hidden_at is null
      and (l.showroom_id is null or exists (
        select 1 from public.subscriptions sub
        join public.subscription_plans pl on pl.id = sub.plan_id
        where sub.showroom_id = l.showroom_id
          and sub.status = 'active'
          and sub.period_end > now()
          and pl.is_active
      ))
  )
$fn$;

-- 2) Phone: is_listing_public() now admits sold, so the explicit active guard
--    keeps the sold state chat-only (server-side guarantee for D2).
create or replace function public.get_seller_phone(p_listing uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $fn$
  select case when l.allow_phone_reveal then u.phone else null end
  from public.listings l
  join public.users u on u.id = l.created_by
  where l.id = p_listing
    and l.state = 'active'
    and public.is_listing_public(p_listing)
$fn$;

-- 3) Lifecycle: owner may bring a sold listing back to active.
create or replace function public.enforce_listing_lifecycle() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
  v_uid uuid := auth.uid();
  v_role text := public.jwt_role();
  v_allowed boolean;
begin
  if new.state is distinct from old.state then
    if v_uid is null or v_role = 'service_role' or public.is_admin() then
      v_allowed := true;  -- admins and server code may move any state anywhere
    else
      v_allowed := case old.state
        when 'draft'         then new.state in ('pending_review')
        when 'pending_review' then new.state in ('active', 'rejected', 'draft')
        when 'active'        then new.state in ('paused', 'sold', 'expired', 'pending_review')
        when 'paused'        then new.state in ('active', 'expired', 'sold')
        when 'sold'          then new.state = 'active'  -- reactivation (0005)
        when 'expired'       then new.state = 'draft'
        when 'rejected'      then new.state = 'draft'
        else false
      end;
    end if;
    if not v_allowed then
      raise exception 'invalid_transition: % -> %', old.state, new.state using errcode = '42501';
    end if;

    if new.state = 'active' and old.state <> 'active' then
      new.published_at := coalesce(new.published_at, now());
      new.expires_at := now() + interval '90 days';
      new.hidden_at := null;
      new.hidden_reason := null;
      new.sold_at := null;  -- reactivation clears the sold marker
    end if;
    if new.state = 'sold' then
      new.sold_at := now();
    end if;
  end if;
  return new;
end
$fn$;

-- 4) Search ranking: sold sorts last (after featured/priority/recency), so a
--    buyer always sees live listings first while sold history stays reachable.
--    Boolean false (active) sorts before true (sold) — pagination-safe.
create or replace function public.search_listings(
  p_filters jsonb default '{}'::jsonb,
  p_limit int default 24,
  p_offset int default 0
) returns setof public.listing_cards
language plpgsql stable security definer set search_path = public, pg_temp as $fn$
declare
  v_brand text := nullif(p_filters ->> 'brand', '');
  v_model text := nullif(p_filters ->> 'model', '');
  v_year_from int := nullif(p_filters ->> 'yearFrom', '')::int;
  v_year_to int := nullif(p_filters ->> 'yearTo', '')::int;
  v_price_from bigint := nullif(p_filters ->> 'priceFrom', '')::bigint;
  v_price_to bigint := nullif(p_filters ->> 'priceTo', '')::bigint;
  v_mileage_max int := nullif(p_filters ->> 'mileageMax', '')::int;
  v_gearbox text := nullif(p_filters ->> 'gearbox', '');
  v_plate text := nullif(p_filters ->> 'plateType', '');
  v_condition text := nullif(p_filters ->> 'condition', '');
  v_city text := nullif(p_filters ->> 'city', '');
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
    and (v_year_from is null or c.year >= v_year_from)
    and (v_year_to is null or c.year <= v_year_to)
    and (v_price_from is null or c.price_irr >= v_price_from)
    and (v_price_to is null or c.price_irr <= v_price_to)
    and (v_mileage_max is null or c.mileage_km <= v_mileage_max)
    and (v_gearbox is null or c.gearbox::text = any (string_to_array(v_gearbox, ',')))
    and (v_plate is null or c.plate_type::text = any (string_to_array(v_plate, ',')))
    and (v_condition is null or c.condition::text = any (string_to_array(v_condition, ',')))
    and (v_city is null or c.city = any (string_to_array(v_city, ',')))
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
