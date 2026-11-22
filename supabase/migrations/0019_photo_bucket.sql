-- ============================================================================
-- Alisales — 0019 photo rows remember their bucket
--
-- 0018 moved new uploads to the public `photos` bucket, but every object
-- uploaded earlier lives in `listing-photos` (0004) and a row only stored its
-- path. Resolving all paths against `photos` would 404 those images.
--
-- The bucket is part of the object's identity, so it is stored with the row:
-- existing rows are backfilled to `listing-photos`, and the column default
-- (`photos`) covers every later insert — the publish and edit paths never have
-- to name a bucket. The `listing_cards` view exposes the cover's bucket next to
-- its path so the catalogue can build the right public URL.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listing_photos'
      and column_name = 'bucket'
  ) then
    alter table public.listing_photos
      add column bucket text not null default 'photos';

    -- Everything stored before this migration was written to the old bucket.
    -- Guarded by the column's absence, so running the file twice cannot move
    -- rows that new uploads wrote to `photos`.
    update public.listing_photos set bucket = 'listing-photos';
  end if;
end
$$;

alter table public.listing_photos
  drop constraint if exists listing_photos_bucket_check;
alter table public.listing_photos
  add constraint listing_photos_bucket_check
  check (bucket in ('photos', 'listing-photos'));

-- Same view as 0014, plus the cover's bucket as the last column (CREATE OR
-- REPLACE VIEW can add columns at the end, but cannot reorder them).
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
  v.inspection_note,
  -- New in 0019: the bucket holding `cover_photo_path`.
  cover.bucket as cover_photo_bucket
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
  select lp.storage_path, lp.bucket
  from public.listing_photos lp
  where lp.listing_id = l.id
  order by lp.position
  limit 1
) cover on true;

grant select on public.listing_cards to anon, authenticated, service_role;
