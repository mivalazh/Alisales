-- ============================================================================
-- 0021 — Real support ticket threads
--
-- 0010 stored one `message` and one `reply` per ticket, so a conversation could
-- never grow past two messages. A ticket is now a thread:
--
--   support_requests          — the envelope (owner, subject, category, status)
--   support_ticket_messages   — append-only messages from the user or support
--
-- Status vocabulary is the one the UI shows:
--   open      «باز»            (new, nobody has answered yet)
--   pending   «در حال بررسی»   (the user replied again)
--   answered  «پاسخ داده شد»   (support answered)
--   closed    «بسته شده»       (closed by the support team)
--
-- `reply` and `message` stay: they are the legacy single-message fields, kept
-- readable for old rows and mirrored into the thread by the backfill below.
-- Everything is service-role only, exactly like 0010.
-- ============================================================================

alter table public.support_requests
  add column if not exists user_id uuid references public.users (id) on delete set null,
  add column if not exists subject text not null default '',
  add column if not exists attachment_url text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.support_requests
  drop constraint if exists support_requests_status_check;

alter table public.support_requests
  add constraint support_requests_status_check
  check (status in ('open', 'pending', 'answered', 'closed'));

alter table public.support_requests
  alter column status set default 'open';

-- Existing rows used only pending/answered; `answered` stays as it was.
update public.support_requests
  set subject = case
    when subject <> '' then subject
    else left(regexp_replace(message, '\s+', ' ', 'g'), 72)
  end,
  updated_at = greatest(updated_at, created_at);

create index if not exists support_requests_user_idx
  on public.support_requests (user_id, updated_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_requests (id) on delete cascade,
  sender_role text not null check (sender_role in ('user', 'admin')),
  sender_id text,
  body text not null check (char_length(body) between 1 and 4000),
  attachment_url text,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_idx
  on public.support_ticket_messages (ticket_id, created_at);

alter table public.support_ticket_messages enable row level security;

revoke all on public.support_ticket_messages from anon, authenticated;
grant select, insert, update, delete on public.support_ticket_messages to service_role;

-- Backfill: the opening message, then the legacy reply (if one exists).
insert into public.support_ticket_messages (ticket_id, sender_role, sender_id, body, created_at)
select id, 'user', null, message, created_at
from public.support_requests
where message <> ''
  and not exists (
    select 1 from public.support_ticket_messages m where m.ticket_id = support_requests.id
  );

insert into public.support_ticket_messages (ticket_id, sender_role, sender_id, body, created_at)
select id, 'admin', 'system', reply, updated_at
from public.support_requests
where reply is not null and reply <> ''
  and not exists (
    select 1 from public.support_ticket_messages m
    where m.ticket_id = support_requests.id and m.sender_role = 'admin'
  );

comment on table public.support_ticket_messages is
  'Append-only support thread messages (user/admin), service-role only.';
comment on column public.support_requests.user_id is
  'Account that owns the ticket; null for guest tickets tracked by code only.';
