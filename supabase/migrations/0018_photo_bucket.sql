-- ============================================================================
-- Alisales — 0018 the public `photos` bucket
--
-- `POST /api/photos` and every cover URL the web app renders use the `photos`
-- bucket. Uploads run on the server with SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses storage RLS, so the bucket only needs to exist and be public-read:
-- a missing bucket is what made /api/photos answer 500.
--
-- `listing-photos` (0004) is left in place for objects stored before this
-- switch; it is no longer written by the app.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

-- Public read, so a cover renders without a signed URL.
drop policy if exists "public read photos" on storage.objects;
create policy "public read photos" on storage.objects
  for select using (bucket_id = 'photos');

-- Writes stay confined to the caller's own folder ({uid}/...). The service role
-- does not need this policy, but it keeps client uploads safe if they return.
drop policy if exists "owner folder upload photos" on storage.objects;
create policy "owner folder upload photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owner folder delete photos" on storage.objects;
create policy "owner folder delete photos" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
