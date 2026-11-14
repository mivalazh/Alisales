-- ============================================================================
-- 0009 — Durable seller profiles and follows
--
-- Moves the social layer off the demo JSON store:
--   * profile_customizations — bio, avatar/cover, personal|business mode and
--     business sub-type, one row per account;
--   * seller_follows — who follows which seller, unique per pair.
--
-- Reads are public because a business storefront (and its follower count) is
-- public. Writes stay owner-only for direct clients; the web app writes with
-- the service role after validating the signed-in session.
-- ============================================================================

create table public.profile_customizations (
  user_id uuid primary key references public.users (id) on delete cascade,
  bio text not null default '' check (char_length(bio) <= 400),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 240000),
  cover_url text check (cover_url is null or char_length(cover_url) <= 240000),
  profile_mode text check (profile_mode in ('personal', 'business')),
  business_type text check (
    business_type in ('car-dealer', 'parts-store', 'workshop', 'rental')
  ),
  updated_at timestamptz not null default now()
);
create trigger profile_customizations_updated_at before update on public.profile_customizations
  for each row execute function public.set_updated_at();

alter table public.profile_customizations enable row level security;

revoke all on public.profile_customizations from anon, authenticated;
grant select on public.profile_customizations to anon, authenticated;
grant insert, update on public.profile_customizations to authenticated;
grant select, insert, update, delete on public.profile_customizations to service_role;

create policy profile_customizations_select_public on public.profile_customizations
  for select using (true);

create policy profile_customizations_insert_own on public.profile_customizations
  for insert to authenticated
  with check (user_id = auth.uid());

create policy profile_customizations_update_own on public.profile_customizations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── seller_follows ──────────────────────────────────────────────────────────
create table public.seller_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.users (id) on delete cascade,
  seller_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, seller_id),
  check (follower_id <> seller_id)
);
create index seller_follows_seller_idx on public.seller_follows (seller_id);
create index seller_follows_follower_idx on public.seller_follows (follower_id);

alter table public.seller_follows enable row level security;

revoke all on public.seller_follows from anon, authenticated;
grant select on public.seller_follows to anon, authenticated;
grant insert, delete on public.seller_follows to authenticated;
grant select, insert, delete on public.seller_follows to service_role;

create policy seller_follows_select_public on public.seller_follows
  for select using (true);

create policy seller_follows_insert_own on public.seller_follows
  for insert to authenticated
  with check (follower_id = auth.uid());

create policy seller_follows_delete_own on public.seller_follows
  for delete to authenticated
  using (follower_id = auth.uid());

comment on table public.profile_customizations is
  'Per-account storefront profile: bio, media URLs, personal/business mode and business type.';
comment on table public.seller_follows is
  'Follower graph for public seller pages; one row per (follower, seller).';
