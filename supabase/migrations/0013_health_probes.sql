-- ============================================================================
-- 0013 — health round-trip table
--
-- `/api/health` writes one row here, reads it back and deletes it, so a health
-- check proves the service-role write path really works. A missing table (an
-- unapplied migration) is then a loud 503 instead of listings that save
-- nowhere. Server-only: no policies and no grants to anon/authenticated.
-- ============================================================================

create table public.health_probes (
  id uuid primary key default gen_random_uuid(),
  note text not null,
  created_at timestamptz not null default now()
);

alter table public.health_probes enable row level security;

revoke all on public.health_probes from anon, authenticated;
grant select, insert, delete on public.health_probes to service_role;

comment on table public.health_probes is
  'Throwaway rows written and deleted by /api/health to prove the service-role round trip.';
