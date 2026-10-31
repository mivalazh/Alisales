-- ============================================================================
-- 0006 — Account favorites + owner-only statistics (views, phone reveals)
--
-- Product rules (S2 / C2):
--   * «بازدید»     = unique users per listing (one row per viewer per listing).
--   * «تماس»       = TWO separate counters that are never combined:
--                      - «گفتگوی جدید»  → rows in public.conversations (0001)
--                      - «نمایش شماره»  → rows in public.phone_reveal_events
--   * «علاقه‌مندی» = current number of accounts that saved the listing,
--                    derived from public.listing_favorites (never a counter).
--   * Every number is visible ONLY to the listing owner. Guests and other
--     users read nothing — enforced by RLS/grants here, not by UI code.
--   * The owner never learns WHO viewed, contacted or saved a listing:
--     viewer_id exists for de-duplication only, and favorites are exposed to
--     the owner solely as an aggregate through listing_favorite_counts().
--
-- Writes for views/reveals come from server code (service_role); clients
-- cannot insert events, so a visitor cannot inflate a seller's numbers.
-- ============================================================================

-- ── listing_favorites (account-backed favorites; replaces localStorage) ────
create table public.listing_favorites (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, user_id)
);
create index listing_favorites_listing_idx on public.listing_favorites (listing_id);
create index listing_favorites_user_idx on public.listing_favorites (user_id);

alter table public.listing_favorites enable row level security;

revoke all on public.listing_favorites from anon, authenticated;
grant select, insert, delete on public.listing_favorites to authenticated;
grant select, insert, delete on public.listing_favorites to service_role;

-- A user manages only their own favorite rows.
create policy listing_favorites_select_own on public.listing_favorites
  for select to authenticated
  using (user_id = auth.uid());

create policy listing_favorites_insert_own on public.listing_favorites
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.hidden_at is null
    )
  );

create policy listing_favorites_delete_own on public.listing_favorites
  for delete to authenticated
  using (user_id = auth.uid());

-- Owner-facing aggregate: counts only, never user ids. Invoker-safe because
-- the function is security definer and filters on auth.uid() itself.
create or replace function public.listing_favorite_counts()
returns table (listing_id uuid, favorite_count int)
language sql stable security definer set search_path = public, pg_temp as $fn$
  select f.listing_id, count(*)::int as favorite_count
  from public.listing_favorites f
  join public.listings l on l.id = f.listing_id
  where l.created_by = auth.uid()
  group by f.listing_id;
$fn$;

revoke all on function public.listing_favorite_counts() from public;
grant execute on function public.listing_favorite_counts() to authenticated;

-- ── listing_views (one row per unique viewer per listing) ──────────────────
create table public.listing_views (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  viewer_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, viewer_id)
);
create index listing_views_listing_idx on public.listing_views (listing_id);
create index listing_views_viewer_idx on public.listing_views (viewer_id);

-- ── phone_reveal_events (append-only: every reveal is a contact) ───────────
create table public.phone_reveal_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  viewer_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index phone_reveal_events_listing_idx on public.phone_reveal_events (listing_id);
create index phone_reveal_events_viewer_idx on public.phone_reveal_events (viewer_id);

alter table public.listing_views enable row level security;
alter table public.phone_reveal_events enable row level security;

revoke all on public.listing_views from anon, authenticated;
revoke all on public.phone_reveal_events from anon, authenticated;

grant select on public.listing_views to authenticated;
grant select on public.phone_reveal_events to authenticated;
grant select, insert, delete on public.listing_views to service_role;
grant select, insert, delete on public.phone_reveal_events to service_role;

create policy listing_views_select_owner on public.listing_views
  for select to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.created_by = auth.uid()
    )
  );

create policy phone_reveal_events_select_owner on public.phone_reveal_events
  for select to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.created_by = auth.uid()
    )
  );

comment on table public.listing_favorites is
  'Account favorites. A user reads/writes only their own rows; owners get counts via listing_favorite_counts().';
comment on table public.listing_views is
  'Unique views per listing (one row per viewer). Owner-only read; written by server code.';
comment on table public.phone_reveal_events is
  'Phone-number reveals per listing (append-only). Owner-only read; written by server code.';
