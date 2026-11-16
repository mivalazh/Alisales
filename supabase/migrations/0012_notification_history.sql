-- ============================================================================
-- 0012 — Durable sold / price-drop notifications
--
-- The bell used to derive a sold item from the listing's publish date and to
-- detect price drops against a localStorage snapshot. Both facts now live on
-- the server:
--   * listing_events      — append-only sold and price-drop history;
--   * notification_reads  — one server-side read marker per account.
--
-- Events are written by the service role only, after the listing change has
-- succeeded. Clients cannot fabricate an event or move another account's read
-- marker, and an event is visible only to accounts that saved before it
-- happened (the feed joins it against listing_favorites.created_at).
-- ============================================================================

create table public.listing_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  kind text not null check (kind in ('sold', 'price_drop')),
  price_irr bigint check (price_irr is null or price_irr >= 0),
  previous_price_irr bigint check (previous_price_irr is null or previous_price_irr >= 0),
  created_at timestamptz not null default now(),
  check (kind <> 'price_drop' or (price_irr is not null and previous_price_irr is not null)),
  check (kind <> 'price_drop' or previous_price_irr > price_irr)
);
create index listing_events_listing_idx
  on public.listing_events (listing_id, created_at desc);

-- Record the event in the same transaction as the listing change. A second
-- application write could succeed after the listing update and then fail, or
-- be skipped by another write path; the trigger cannot.
create or replace function public.record_listing_notification_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if new.state = 'sold' and old.state is distinct from 'sold' then
    insert into public.listing_events (listing_id, kind, created_at)
    values (new.id, 'sold', coalesce(new.sold_at, now()));
  elsif new.price_irr < old.price_irr then
    insert into public.listing_events
      (listing_id, kind, price_irr, previous_price_irr)
    values (new.id, 'price_drop', new.price_irr, old.price_irr);
  end if;
  return new;
end
$fn$;

revoke all on function public.record_listing_notification_event() from public;

create trigger listings_notification_event
  after update on public.listings
  for each row execute function public.record_listing_notification_event();

alter table public.listing_events enable row level security;

revoke all on public.listing_events from anon, authenticated;
grant select, insert, delete on public.listing_events to service_role;

create table public.notification_reads (
  user_id uuid primary key references public.users (id) on delete cascade,
  read_at timestamptz not null default now()
);

alter table public.notification_reads enable row level security;

revoke all on public.notification_reads from anon, authenticated;
grant select, insert, update, delete on public.notification_reads to service_role;

-- Use the database clock for every device, never the browser/server clock.
create or replace function public.mark_notification_read(p_user uuid)
returns timestamptz
language sql
security definer
set search_path = public, pg_temp
as $fn$
  insert into public.notification_reads (user_id, read_at)
  values (p_user, now())
  on conflict (user_id) do update set read_at = now()
  returning read_at;
$fn$;

revoke all on function public.mark_notification_read(uuid) from public;
grant execute on function public.mark_notification_read(uuid) to service_role;

comment on table public.listing_events is
  'Append-only sold and price-drop history. Service-role writes only; the notification feed reads it for saved listings.';
comment on table public.notification_reads is
  'Per-account bell read marker, so unread state follows the account across devices.';
