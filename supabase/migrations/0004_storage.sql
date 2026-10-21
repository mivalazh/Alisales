-- ============================================================================
-- Alisales — 0004 storage buckets & object policies
-- listing-photos / report-photos: public read, writes confined to the caller's
-- own folder ({uid}/...). showroom-licenses: private (admin/owner only).
-- EXIF removal + webp conversion happen client-side before upload; the DB
-- enforces mime/bytes constraints on the corresponding metadata rows.
-- ============================================================================

do $do$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    -- PGlite test stub (real Supabase already ships the storage schema).
    create schema storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean not null default false,
      created_at timestamptz not null default now()
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text not null,
      owner uuid,
      created_at timestamptz not null default now()
    );
    create or replace function storage.foldername(name text) returns text[]
    language sql immutable as $fn$
      select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
    $fn$;
  end if;

  insert into storage.buckets (id, name, public)
  values
    ('listing-photos', 'listing-photos', true),
    ('report-photos', 'report-photos', true),
    ('showroom-licenses', 'showroom-licenses', false)
  on conflict (id) do nothing;
end
$do$;

-- Public read for media buckets
create policy "public read listing photos" on storage.objects
  for select using (bucket_id = 'listing-photos');
create policy "public read report photos" on storage.objects
  for select using (bucket_id = 'report-photos');

-- Writes only inside the caller's own folder
create policy "owner folder upload listing photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner folder delete listing photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "inspector folder upload report photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_role('inspector')
  );

create policy "inspector folder delete report photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.has_role('inspector')
  );

-- License uploads: owner of the showroom or admin, read restricted likewise.
create policy "license upload owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'showroom-licenses'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "license read owner or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'showroom-licenses'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
