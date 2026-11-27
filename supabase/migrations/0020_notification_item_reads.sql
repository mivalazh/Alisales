-- ============================================================================
-- 0020 — Per-item bell reads
--
-- 0012 kept one `read_at` marker per account, which only supports «mark all».
-- Opening a single item must lower the header badge by exactly one, so the
-- same row now also carries the ids of the items the reader has opened:
--
--   read_items text[]  — notification ids (e.g. `listing-event-<uuid>`).
--
-- `read_at` keeps its meaning: every item older than it is read. Service role
-- only, exactly like the rest of the table.
-- ============================================================================

alter table public.notification_reads
  add column if not exists read_items text[] not null default '{}';

comment on column public.notification_reads.read_items is
  'Ids of individual bell items the account has opened, so one click clears one badge.';
