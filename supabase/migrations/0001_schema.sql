-- ============================================================================
-- Alisales — 0001 core schema
-- Tables: users, showrooms, showroom_staff, subscription_plans, subscriptions,
-- subscription_payments (idempotency ledger), vehicles, listings, listing_photos,
-- inspection_reports, report_versions, report_photos, conversations, messages,
-- abuse_reports
-- ============================================================================

-- ── Supabase roles (no-op on real Supabase; created for PGlite test runs) ───
do $do$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end
$do$;

-- ── auth schema stubs (guarded: real Supabase already has these) ────────────
do $do$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'auth' and table_name = 'users'
  ) then
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      phone text,
      created_at timestamptz not null default now()
    );
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    create function auth.uid() returns uuid
    language sql stable
    as $fn$
      select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid
    $fn$;
  end if;
end
$do$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- ── Enum types ──────────────────────────────────────────────────────────────
create type listing_state as enum
  ('draft', 'pending_review', 'active', 'paused', 'sold', 'expired', 'rejected');
create type plate_type as enum ('standard', 'kish', 'temporary_transit', 'unplated');
create type vehicle_condition as enum ('new', 'used');
create type gearbox_type as enum ('manual', 'automatic', 'cvt', 'dual_clutch');
create type fuel_type as enum ('petrol', 'diesel', 'cng', 'hybrid', 'electric');
create type color_slug as enum
  ('white','black','silver','gray','red','blue','green','beige','brown','gold','orange','other');
create type body_panel_condition as enum ('original', 'repainted', 'replaced', 'damaged');
create type user_role as enum ('individual', 'inspector', 'admin');
create type staff_role as enum ('owner', 'editor');
create type subscription_status as enum ('pending', 'active', 'past_due', 'cancelled', 'expired');
create type report_status as enum ('draft', 'finalized');
create type license_status as enum ('not_submitted', 'pending', 'approved', 'rejected');
create type payment_status as enum ('created', 'paid', 'failed', 'refunded');
create type abuse_status as enum ('open', 'reviewing', 'dismissed', 'actioned');
create type abuse_reason as enum
  ('fraud', 'wrong_info', 'inappropriate', 'copyright', 'spam', 'other');

-- ── Shared trigger helper ───────────────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end
$fn$;

-- ── users ───────────────────────────────────────────────────────────────────
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text not null unique,
  display_name text not null check (char_length(display_name) between 2 and 80),
  role user_role not null default 'individual',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- ── showrooms ───────────────────────────────────────────────────────────────
create table public.showrooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  name text not null check (char_length(name) between 2 and 120),
  city text not null,
  phone text,
  description text,
  license_status license_status not null default 'not_submitted',
  license_photo_path text,      -- private: column-restricted, admin/owner only
  license_review_note text,     -- admin only
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index showrooms_owner_idx on public.showrooms (owner_id);
create trigger showrooms_updated_at before update on public.showrooms
  for each row execute function public.set_updated_at();

-- ── showroom_staff ──────────────────────────────────────────────────────────
create table public.showroom_staff (
  showroom_id uuid not null references public.showrooms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role staff_role not null default 'editor',
  created_at timestamptz not null default now(),
  primary key (showroom_id, user_id)
);
create index showroom_staff_user_idx on public.showroom_staff (user_id);

-- ── subscription_plans (admin-managed; seeded by supabase/seed.sql) ─────────
create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('free', 'basic', 'pro')),
  name text not null,
  price_irr bigint not null check (price_irr >= 0),
  listing_limit int not null check (listing_limit >= 1),
  featured_slots int not null default 0 check (featured_slots >= 0),
  free_inspections_per_month int not null default 0 check (free_inspections_per_month >= 0),
  search_priority int not null default 0 check (search_priority >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscription_plans_updated_at before update on public.subscription_plans
  for each row execute function public.set_updated_at();

-- ── subscriptions (either a user or a showroom, never both) ────────────────
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  showroom_id uuid references public.showrooms (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  status subscription_status not null default 'pending',
  period_start timestamptz not null default now(),
  period_end timestamptz not null default now() + interval '1 month',
  auto_renew boolean not null default true,
  renewal_reminder_sent_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is null) <> (showroom_id is null))
);
create index subscriptions_user_idx on public.subscriptions (user_id);
create index subscriptions_showroom_idx on public.subscriptions (showroom_id);
-- one live subscription per account
create unique index subscriptions_one_active_per_account
  on public.subscriptions (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'active';
create unique index subscriptions_one_active_per_showroom
  on public.subscriptions (showroom_id)
  where status = 'active' and showroom_id is not null;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ── subscription_payments (server-side idempotency ledger) ─────────────────
create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  provider text not null default 'zarinpal',
  provider_ref text not null,          -- gateway authority / transaction id
  amount_irr bigint not null check (amount_irr >= 0),
  status payment_status not null default 'created',
  paid_at timestamptz,
  callback_raw jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);
create index subscription_payments_sub_idx on public.subscription_payments (subscription_id);

-- ── vehicles ────────────────────────────────────────────────────────────────
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.users (id) on delete cascade,
  brand text not null,
  model text not null check (char_length(model) between 1 and 60),
  trim text,
  year int not null check (year between 1300 and 1420),      -- Jalali
  mileage_km int not null check (mileage_km >= 0),
  gearbox gearbox_type not null,
  fuel fuel_type not null,
  color color_slug not null,
  condition vehicle_condition not null,
  plate_type plate_type not null default 'standard',
  vin text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vehicles_created_by_idx on public.vehicles (created_by);
create index vehicles_segment_idx on public.vehicles (brand, model, year);
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

-- ── listings ────────────────────────────────────────────────────────────────
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  created_by uuid not null references public.users (id) on delete cascade,
  showroom_id uuid references public.showrooms (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  price_irr bigint not null check (price_irr >= 0),
  city text not null,
  description text not null default '' check (char_length(description) <= 3000),
  state listing_state not null default 'draft',
  allow_phone_reveal boolean not null default false,
  featured boolean not null default false,
  featured_until timestamptz,
  hidden_at timestamptz,
  hidden_reason text,
  price_anomaly boolean not null default false,
  report_id uuid,                       -- FK added below (inspection_reports)
  published_at timestamptz,
  expires_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (city in
    ('kish','tehran','mashhad','isfahan','shiraz','tabriz','ahvaz','rasht','kerman','yazd','bandar-abbas'))
);
create index listings_state_idx on public.listings (state);
create index listings_created_by_idx on public.listings (created_by);
create index listings_showroom_idx on public.listings (showroom_id);
create index listings_published_idx on public.listings (published_at desc);
create trigger listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();

-- ── listing_photos ──────────────────────────────────────────────────────────
create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null unique,
  position int not null check (position between 0 and 19),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes int not null check (bytes between 1 and 8388608),   -- ≤ 8 MB after webp
  width int not null check (width > 0),
  height int not null check (height > 0),
  created_at timestamptz not null default now(),
  unique (listing_id, position)
);

-- ── inspection_reports (workshop reports; one finalized report per listing) ─
create table public.inspection_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid unique references public.listings (id) on delete set null,
  inspector_id uuid not null references public.users (id) on delete restrict,
  -- identity snapshot (matches the standardized form)
  brand text not null,
  model text not null,
  year int not null check (year between 1300 and 1420),
  vin text check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  mileage_km int not null check (mileage_km >= 0),
  status report_status not null default 'draft',
  current_version int not null default 1 check (current_version >= 1),
  final_hash text check (final_hash is null or final_hash ~ '^[0-9a-f]{64}$'),
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inspection_reports_inspector_idx on public.inspection_reports (inspector_id);
create index inspection_reports_listing_idx on public.inspection_reports (listing_id);
create trigger inspection_reports_updated_at before update on public.inspection_reports
  for each row execute function public.set_updated_at();

-- listing.attach(1 finalized report)
alter table public.listings
  add constraint listings_one_report_fk
  foreign key (report_id) references public.inspection_reports (id) on delete set null;
create unique index listings_one_report_idx on public.listings (report_id)
  where report_id is not null;

-- ── report_versions (append-only; edits create new versions) ────────────────
create table public.report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.inspection_reports (id) on delete cascade,
  version int not null check (version >= 1),
  content jsonb not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references public.users (id) on delete restrict,
  finalized boolean not null default false,
  created_at timestamptz not null default now(),
  unique (report_id, version)
);

-- ── report_photos (per version, so old versions keep their photo set) ──────
create table public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_version_id uuid not null references public.report_versions (id) on delete cascade,
  slot text not null,                  -- required photo set slot (see schemas pkg)
  position int not null default 0 check (position >= 0),
  storage_path text not null unique,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes int not null check (bytes between 1 and 8388608),
  created_at timestamptz not null default now()
);
create index report_photos_version_idx on public.report_photos (report_version_id);

-- ── conversations / messages ───────────────────────────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.users (id) on delete cascade,
  seller_id uuid not null references public.users (id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);
create index conversations_seller_idx on public.conversations (seller_id);
create index conversations_buyer_idx on public.conversations (buyer_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ── abuse_reports ───────────────────────────────────────────────────────────
create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter_id uuid not null references public.users (id) on delete cascade,
  reason abuse_reason not null,
  details text check (details is null or char_length(details) <= 1000),
  status abuse_status not null default 'open',
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);
create index abuse_reports_status_idx on public.abuse_reports (status);
