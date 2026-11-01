-- ============================================================================
-- 0007 — Parts listings + structured visit metadata (hosted persistence)
--
-- Closes the hosted gap left open by S2:
--   * `parts_listings` needs a home in the database. A listing is either a
--     vehicle (`kind = 'vehicle'`, vehicle_id required) or a part
--     (`kind = 'part'`, vehicle_id null, details in public.part_details).
--   * `visit_request_chat` needs the structured slot persisted, not just the
--     human-readable body: messages carry `kind` + an optional visit slot.
--
-- Payment guardrail (unchanged by design): nothing here touches payments.
-- subscription_payments / apply_payment_result remain the ONLY money path and
-- are reserved for subscriptions, bump-up (نردبان) and stories. There is no
-- checkout, gateway callback or commission table for vehicles, parts or
-- inspections.
-- ============================================================================

-- ── 1) Listings: vehicle | part ─────────────────────────────────────────────
alter table public.listings
  add column kind text not null default 'vehicle';

alter table public.listings
  add constraint listings_kind_valid check (kind in ('vehicle', 'part'));

-- Parts have no vehicles row, so the old NOT NULL cannot stand for them.
alter table public.listings alter column vehicle_id drop not null;

-- Exactly one shape: a car needs its vehicle, a part must not claim one.
-- Unknown kinds are left to listings_kind_valid so the error names the real
-- problem instead of also tripping this shape rule.
alter table public.listings
  add constraint listings_kind_shape check (
    kind not in ('vehicle', 'part')
    or (kind = 'vehicle' and vehicle_id is not null)
    or (kind = 'part' and vehicle_id is null)
  );

-- ── 2) Part details (one row per part listing) ──────────────────────────────
create table public.part_details (
  listing_id uuid primary key references public.listings (id) on delete cascade,
  category text not null check (category in
    ('engine', 'brake', 'body', 'electrical', 'interior', 'tires', 'oil_filters', 'other')),
  title text not null check (char_length(title) between 3 and 80),
  origin text not null check (origin in ('original', 'commercial', 'unknown')),
  condition text not null check (condition in ('new', 'used')),
  part_number text check (part_number is null or char_length(part_number) <= 32),
  compatibility text check (compatibility is null or char_length(compatibility) <= 80),
  warranty text check (warranty is null or char_length(warranty) <= 60),
  created_at timestamptz not null default now()
);
create index part_details_category_idx on public.part_details (category);

alter table public.part_details enable row level security;

-- Part details are public data, but only for listings the public may see:
-- a hidden/draft part never leaks its title or part number.
revoke all on public.part_details from anon, authenticated;
grant select on public.part_details to anon, authenticated;
grant select, insert, update, delete on public.part_details to service_role;

create policy part_details_select_public on public.part_details
  for select to anon, authenticated
  using (public.is_listing_public(listing_id));

comment on table public.part_details is
  'Parts & accessories details. Public for public listings; written by server code only.';
comment on column public.listings.kind is
  'vehicle | part — parts live in part_details and have no vehicles row.';

-- ── 3) Messages: structured visit requests ──────────────────────────────────
alter table public.messages
  add column kind text not null default 'text',
  add column visit_date date,
  add column visit_time text;

alter table public.messages
  add constraint messages_kind_valid check
    (kind in ('text', 'visit_request', 'visit_accept', 'visit_counter')),
  add constraint messages_visit_time_format check
    (visit_time is null or visit_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add constraint messages_visit_time_needs_date check
    (visit_time is null or visit_date is not null),
  add constraint messages_text_has_no_visit check
    (kind <> 'text' or (visit_date is null and visit_time is null));

comment on column public.messages.kind is
  'text for normal chat; visit_request/accept/counter carry the structured slot.';

-- ── 4) Public projection: expose parts without a second query path ──────────
-- Column list and order are identical to 0002; only the added columns at the
-- end are new (CREATE OR REPLACE VIEW may only append). Vehicles become a LEFT
-- join so parts (vehicle_id null) stay visible, and part fields are appended.
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
  pd.warranty as part_warranty
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
