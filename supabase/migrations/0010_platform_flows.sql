-- ============================================================================
-- 0010 — Durable platform flows
--
-- Moves the remaining launch flows off the demo JSON stores:
--   * story_submissions   — user stories and their moderation status;
--   * inspection_bookings — guest/seller workshop inspection requests;
--   * support_requests    — ticket codes, replies and contact details;
--   * ai_faq_counts       — assistant topic counters;
--   * platform_settings   — launch switches such as the story paid guard.
--
-- Public reads are limited to approved stories. Bookings, tickets, counters and
-- settings are server-only; every admin/support read goes through the service
-- role after the session has been checked.
-- ============================================================================

-- ── story_submissions ───────────────────────────────────────────────────────
create table public.story_submissions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  media_url text not null check (char_length(media_url) between 1 and 12000000),
  media_kind text not null check (media_kind in ('image', 'video')),
  author_id uuid not null references public.users (id) on delete cascade,
  author_name text not null default '',
  listing_slug text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index story_submissions_status_idx on public.story_submissions (status, created_at desc);
create index story_submissions_author_idx on public.story_submissions (author_id);

alter table public.story_submissions enable row level security;

revoke all on public.story_submissions from anon, authenticated;
grant select on public.story_submissions to anon, authenticated;
grant select, insert, update, delete on public.story_submissions to service_role;

create policy story_submissions_select_approved on public.story_submissions
  for select using (status = 'approved');

-- ── inspection_bookings ─────────────────────────────────────────────────────
create table public.inspection_bookings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 80),
  phone text not null,
  date text not null,
  time text not null,
  vehicle text not null,
  listing_slug text,
  listing_title text,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);
create index inspection_bookings_created_idx on public.inspection_bookings (created_at desc);
create index inspection_bookings_phone_idx on public.inspection_bookings (phone);
create index inspection_bookings_status_idx on public.inspection_bookings (status);

alter table public.inspection_bookings enable row level security;

revoke all on public.inspection_bookings from anon, authenticated;
grant select, insert, update, delete on public.inspection_bookings to service_role;

-- ── support_requests ────────────────────────────────────────────────────────
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('brand', 'ticket')),
  topic text not null check (topic in ('technical', 'advertising', 'suggestion', 'report')),
  code text not null unique check (char_length(code) between 3 and 32),
  status text not null default 'pending' check (status in ('pending', 'answered')),
  reply text,
  name text not null,
  contact text not null,
  model text not null default '',
  message text not null,
  created_at timestamptz not null default now()
);
create index support_requests_created_idx on public.support_requests (created_at desc);

alter table public.support_requests enable row level security;

revoke all on public.support_requests from anon, authenticated;
grant select, insert, update, delete on public.support_requests to service_role;

-- ── ai_faq_counts ───────────────────────────────────────────────────────────
create table public.ai_faq_counts (
  topic text primary key check (char_length(topic) between 1 and 200),
  count integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ai_faq_counts enable row level security;

revoke all on public.ai_faq_counts from anon, authenticated;
grant select, insert, update, delete on public.ai_faq_counts to service_role;

-- Atomic counter update, callable only by the service role used by the server.
create or replace function public.increment_faq_topic(topic_name text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $fn$
  insert into public.ai_faq_counts (topic, count)
  values (topic_name, 1)
  on conflict (topic) do update
    set count = public.ai_faq_counts.count + 1,
        updated_at = now();
$fn$;

revoke all on function public.increment_faq_topic(text) from public;
grant execute on function public.increment_faq_topic(text) to service_role;

-- ── platform_settings ───────────────────────────────────────────────────────
create table public.platform_settings (
  singleton boolean primary key default true check (singleton),
  story_paid_guard boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (singleton) values (true) on conflict do nothing;

create trigger platform_settings_updated_at before update on public.platform_settings
  for each row execute function public.set_updated_at();

alter table public.platform_settings enable row level security;

revoke all on public.platform_settings from anon, authenticated;
grant select, insert, update, delete on public.platform_settings to service_role;

comment on table public.story_submissions is
  'User-uploaded stories; only approved rows are publicly readable.';
comment on table public.inspection_bookings is
  'Workshop inspection requests, including guest bookings. Server/admin only.';
comment on table public.support_requests is
  'Support tickets and contact details. Server/admin only.';
comment on table public.ai_faq_counts is
  'Assistant topic counters, incremented atomically by increment_faq_topic().';
comment on table public.platform_settings is
  'Singleton launch switches such as the story paid guard.';
