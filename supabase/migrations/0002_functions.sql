-- ============================================================================
-- Alisales — 0002 functions & triggers
-- Helpers, listing guards (plan limits, rate limits, transitions, price
-- anomaly), moderation automation, payment idempotency, search RPC.
-- All helpers are SECURITY DEFINER with a pinned search_path.
-- ============================================================================

-- ── Generic helpers ─────────────────────────────────────────────────────────
create or replace function public.jwt_role() returns text
language sql stable as $fn$
  select nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role'
$fn$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
$fn$;

create or replace function public.has_role(p_role user_role) returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = p_role)
$fn$;

create or replace function public.is_showroom_owner(p_showroom uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select exists (select 1 from public.showrooms s where s.id = p_showroom and s.owner_id = p_user)
$fn$;

create or replace function public.is_showroom_staff(
  p_showroom uuid, p_user uuid, p_roles staff_role[] default array['owner','editor']::staff_role[]
) returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select public.is_showroom_owner(p_showroom, p_user)
    or exists (
      select 1 from public.showroom_staff st
      where st.showroom_id = p_showroom and st.user_id = p_user and st.role = any (p_roles)
    )
$fn$;

-- ── Plan / subscription resolution ──────────────────────────────────────────
create or replace function public.effective_plan(p_user uuid, p_showroom uuid)
returns table (
  code text, listing_limit int, featured_slots int,
  free_inspections_per_month int, search_priority int
)
language sql stable security definer set search_path = public, pg_temp as $fn$
  select pl.code, pl.listing_limit, pl.featured_slots,
         pl.free_inspections_per_month, pl.search_priority
  from public.subscriptions sub
  join public.subscription_plans pl on pl.id = sub.plan_id
  where sub.status = 'active'
    and sub.period_end > now()
    and pl.is_active
    and (case
      when p_showroom is not null then sub.showroom_id = p_showroom
      else sub.user_id = p_user
    end)
  order by pl.search_priority desc
  limit 1
$fn$;

-- Showrooms without a live subscription get limit 0 (lapsed → hidden, not deleted).
-- Individuals default to the seeded 'free' plan (2 concurrent listings).
create or replace function public.listing_limit_for(p_user uuid, p_showroom uuid) returns int
language sql stable security definer set search_path = public, pg_temp as $fn$
  select case
    when p_showroom is not null then
      coalesce((select ep.listing_limit from public.effective_plan(null, p_showroom) ep limit 1), 0)
    else coalesce(
      (select ep.listing_limit from public.effective_plan(p_user, null) ep limit 1),
      (select pl.listing_limit from public.subscription_plans pl where pl.code = 'free')
    )
  end
$fn$;

create or replace function public.count_listing_slots(p_user uuid, p_showroom uuid) returns bigint
language sql stable security definer set search_path = public, pg_temp as $fn$
  select count(*) from public.listings l
  where (case
    when p_showroom is not null then l.showroom_id = p_showroom
    else l.created_by = p_user and l.showroom_id is null
  end)
    and l.state in ('draft', 'pending_review', 'active', 'paused')
$fn$;

-- ── Public visibility ───────────────────────────────────────────────────────
create or replace function public.is_listing_public(p_listing uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select exists (
    select 1 from public.listings l
    where l.id = p_listing
      and l.state = 'active'
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

-- Phone stays masked until the seller opts in (or the listing isn't public).
create or replace function public.get_seller_phone(p_listing uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $fn$
  select case when l.allow_phone_reveal then u.phone else null end
  from public.listings l
  join public.users u on u.id = l.created_by
  where l.id = p_listing and public.is_listing_public(p_listing)
$fn$;

-- License documents are column-restricted on public.showrooms; owners and
-- admins read them through this definer RPC instead.
create or replace function public.get_showroom_license(p_showroom uuid)
returns table (license_photo_path text, license_review_note text, license_status license_status)
language sql stable security definer set search_path = public, pg_temp as $fn$
  select s.license_photo_path, s.license_review_note, s.license_status
  from public.showrooms s
  where s.id = p_showroom and (s.owner_id = auth.uid() or public.is_admin())
$fn$;

-- ── Listing guards ──────────────────────────────────────────────────────────
create or replace function public.enforce_listing_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
  v_uid uuid := auth.uid();
  v_role text := public.jwt_role();
  v_used bigint;
  v_target_user uuid;
  v_target_showroom uuid;
begin
  -- Rate limit: 5 listing creations per user per hour (user-context only).
  if tg_op = 'INSERT' and v_uid is not null
     and v_role is distinct from 'service_role' and not public.is_admin() then
    if (select count(*) from public.listings l
        where l.created_by = v_uid and l.created_at > now() - interval '1 hour') >= 5 then
      raise exception 'rate_limit: listing creation limited to 5 per hour'
        using errcode = '42501';
    end if;
  end if;

  -- Plan slot limit (enforced for user contexts; server/service contexts skip).
  if v_uid is not null and v_role is distinct from 'service_role' then
    if tg_op = 'INSERT' then
      if new.state in ('draft', 'pending_review', 'active', 'paused') then
        v_used := public.count_listing_slots(new.created_by, new.showroom_id);
        if v_used >= public.listing_limit_for(new.created_by, new.showroom_id) then
          raise exception 'plan_limit: listing limit reached for the current plan (upgrade to post more)'
            using errcode = '42501';
        end if;
      end if;
    else
      if new.state in ('draft', 'pending_review', 'active', 'paused')
         and (old.state is distinct from new.state
              or old.showroom_id is distinct from new.showroom_id) then
        v_target_user := new.created_by;
        v_target_showroom := new.showroom_id;
        v_used := public.count_listing_slots(v_target_user, v_target_showroom)
                  - case when old.state in ('draft','pending_review','active','paused') then 1 else 0 end;
        if v_used >= public.listing_limit_for(v_target_user, v_target_showroom) then
          raise exception 'plan_limit: listing limit reached for the current plan (upgrade to post more)'
            using errcode = '42501';
        end if;
      end if;
    end if;
  end if;

  return new;
end
$fn$;

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
        when 'sold'          then false
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
    end if;
    if new.state = 'sold' then
      new.sold_at := now();
    end if;
  end if;
  return new;
end
$fn$;

-- Price anomaly: far from the segment median (±40%) → flag + send to review.
create or replace function public.check_price_anomaly() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
  v_brand text;
  v_model text;
  v_year int;
  v_count bigint;
  v_median numeric;
begin
  if new.state not in ('pending_review', 'active') then
    return new;
  end if;

  select v2.brand, v2.model, v2.year into v_brand, v_model, v_year
  from public.vehicles v2 where v2.id = new.vehicle_id;

  select count(*), percentile_cont(0.5) within group (order by l.price_irr)
    into v_count, v_median
  from public.listings l
  join public.vehicles v3 on v3.id = l.vehicle_id
  where l.state = 'active'
    and l.id is distinct from new.id
    and v3.brand = v_brand
    and v3.model = v_model
    and abs(v3.year - v_year) <= 1;

  if v_count >= 3 and coalesce(v_median, 0) > 0 then
    if new.price_irr < 0.6 * v_median or new.price_irr > 1.6 * v_median then
      new.price_anomaly := true;
      if tg_op = 'UPDATE' and new.state = 'active'
         and auth.uid() is not null
         and public.jwt_role() is distinct from 'service_role'
         and not public.is_admin() then
        new.state := 'pending_review';   -- bounce to review, keep the flag
      end if;
    else
      new.price_anomaly := false;
    end if;
  end if;
  return new;
end
$fn$;

create or replace function public.users_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'only admins can change account roles' using errcode = '42501';
  end if;
  return new;
end
$fn$;

create or replace function public.showrooms_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  if tg_op = 'INSERT' and new.license_photo_path is not null then
    new.license_status := 'pending';
  end if;
  if tg_op = 'UPDATE' then
    if new.license_status is distinct from old.license_status and not public.is_admin() then
      raise exception 'only admins can change license status' using errcode = '42501';
    end if;
    if new.license_photo_path is distinct from old.license_photo_path and not public.is_admin() then
      new.license_status := 'pending';          -- resubmission re-enters the queue
      new.license_review_note := null;
      new.reviewed_by := null;
      new.reviewed_at := null;
      if new.is_verified is distinct from old.is_verified then
        new.is_verified := old.is_verified;     -- verification follows review only
      end if;
    end if;
  end if;
  return new;
end
$fn$;

create or replace function public.subscriptions_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  if tg_op = 'UPDATE' and auth.uid() is not null
     and public.jwt_role() is distinct from 'service_role'
     and not public.is_admin() then
    if new.plan_id is distinct from old.plan_id
       or new.period_start is distinct from old.period_start
       or new.period_end is distinct from old.period_end
       or new.user_id is distinct from old.user_id
       or new.showroom_id is distinct from old.showroom_id then
      raise exception 'subscription terms are server-managed' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and not (old.status in ('active', 'past_due') and new.status = 'cancelled') then
      raise exception 'only cancellation is allowed from the client' using errcode = '42501';
    end if;
  end if;
  return new;
end
$fn$;

create or replace function public.messages_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  if auth.uid() is not null and public.jwt_role() is distinct from 'service_role' then
    if (select count(*) from public.messages m
        where m.sender_id = new.sender_id and m.created_at > now() - interval '5 minutes') >= 30 then
      raise exception 'rate_limit: messaging limited to 30 messages per 5 minutes'
        using errcode = '42501';
    end if;
  end if;
  return new;
end
$fn$;

-- Report versions are append-only: editing a finalized report creates a new
-- version row; existing rows can never change (tamper evidence).
create or replace function public.report_versions_immutable() returns trigger
language plpgsql as $fn$
begin
  raise exception 'report_versions rows are immutable' using errcode = '42501';
end
$fn$;

-- ── Moderation automation ───────────────────────────────────────────────────
create or replace function public.abuse_hide_threshold() returns int
language sql stable as $fn$ select 5 $fn$;

create or replace function public.hide_on_abuse_threshold() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $fn$
begin
  if (select count(*) from public.abuse_reports ar
      where ar.listing_id = new.listing_id and ar.status <> 'dismissed')
     >= public.abuse_hide_threshold() then
    update public.listings l
      set hidden_at = now(), hidden_reason = 'abuse_threshold', updated_at = now()
      where l.id = new.listing_id and l.hidden_at is null;
  end if;
  return new;
end
$fn$;

create or replace function public.expire_stale_listings() returns bigint
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_count bigint;
begin
  update public.listings l
    set state = 'expired', updated_at = now()
    where l.state = 'active' and l.expires_at is not null and l.expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end
$fn$;

-- ── Payments: idempotent callback ledger ────────────────────────────────────
-- Called by the payment-callback edge function (service role). The unique
-- (provider, provider_ref) row plus the paid-transition guard make replays safe.
create or replace function public.apply_payment_result(
  p_provider text,
  p_provider_ref text,
  p_subscription_id uuid,
  p_amount_irr bigint,
  p_paid boolean,
  p_callback jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
  v_payment public.subscription_payments%rowtype;
  v_replayed boolean := false;
begin
  select * into v_payment from public.subscription_payments sp
    where sp.provider = p_provider and sp.provider_ref = p_provider_ref
    for update;

  if found then
    if v_payment.status = 'paid' then
      -- Replay: report success, extend nothing.
      return jsonb_build_object('idempotent', true, 'paid', true, 'payment_id', v_payment.id);
    end if;
    v_replayed := true;
    update public.subscription_payments sp
      set status = case when p_paid then 'paid'::payment_status else 'failed'::payment_status end,
          paid_at = case when p_paid then now() else null end,
          callback_raw = p_callback
      where sp.id = v_payment.id;
    if not p_paid then
      return jsonb_build_object('idempotent', v_replayed, 'paid', false, 'payment_id', v_payment.id);
    end if;
  else
    begin
      insert into public.subscription_payments
        (subscription_id, provider, provider_ref, amount_irr, status, paid_at, callback_raw)
      values
        (p_subscription_id, p_provider, p_provider_ref, p_amount_irr,
         case when p_paid then 'paid'::payment_status else 'failed'::payment_status end,
         case when p_paid then now() else null end, p_callback)
      returning * into v_payment;
    exception when unique_violation then
      -- Concurrent first delivery: let the winner commit; report idempotent replay.
      return jsonb_build_object('idempotent', true, 'paid', false);
    end;
    if not p_paid then
      return jsonb_build_object('idempotent', false, 'paid', false, 'payment_id', v_payment.id);
    end if;
  end if;

  update public.subscriptions s
    set status = 'active',
        period_end = case
          when s.period_end > now() then s.period_end + interval '1 month'
          else now() + interval '1 month'
        end,
        renewal_reminder_sent_at = null,
        updated_at = now()
    where s.id = p_subscription_id;

  return jsonb_build_object(
    'idempotent', v_replayed,
    'paid', true,
    'payment_id', v_payment.id
  );
end
$fn$;

-- ── Search RPC (single filter implementation, used by web + mobile) ─────────
-- Public listing card projection. `security_invoker` keeps RLS in force for
-- direct reads by anon/authenticated; SECURITY DEFINER callers re-filter with
-- is_listing_public() inside the RPC below.
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
  v.brand,
  v.model,
  v.trim,
  v.year,
  v.mileage_km,
  v.gearbox,
  v.fuel,
  v.color,
  v.condition,
  v.plate_type,
  cover.storage_path as cover_photo_path,
  coalesce(ep.search_priority, 0) as search_priority,
  s.name as showroom_name,
  s.slug as showroom_slug,
  s.is_verified as showroom_verified
from public.listings l
join public.vehicles v on v.id = l.vehicle_id
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
  order by c.featured desc nulls last,
           c.search_priority desc,
           c.published_at desc nulls last,
           c.created_at desc,
           c.id desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
end
$fn$;

-- ── Trigger wiring ──────────────────────────────────────────────────────────
-- Trigger names fire in alphabetical order on the same event:
-- listings_guard → listings_lifecycle → listings_price_anomaly
create trigger listings_guard before insert or update on public.listings
  for each row execute function public.enforce_listing_guard();
create trigger listings_lifecycle before update on public.listings
  for each row execute function public.enforce_listing_lifecycle();
create trigger listings_price_anomaly before insert or update on public.listings
  for each row execute function public.check_price_anomaly();

create trigger users_role_guard before update on public.users
  for each row execute function public.users_guard();
create trigger showrooms_license_guard before insert or update on public.showrooms
  for each row execute function public.showrooms_guard();
create trigger subscriptions_terms_guard before update on public.subscriptions
  for each row execute function public.subscriptions_guard();
create trigger messages_rate_guard before insert on public.messages
  for each row execute function public.messages_guard();
create trigger report_versions_immutable before update on public.report_versions
  for each row execute function public.report_versions_immutable();
create trigger abuse_reports_hide_threshold after insert on public.abuse_reports
  for each row execute function public.hide_on_abuse_threshold();
