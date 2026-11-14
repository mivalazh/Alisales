-- ============================================================================
-- 0011 — Durable profile and story media buckets
--
-- Profile avatars/covers and story images/clips are uploaded by the server
-- routes with the service role after the session is checked. The buckets are
-- public-read because the profile page and story rail render them directly.
-- Direct client writes are intentionally not granted; cleanup uses the service
-- role when a profile image is replaced or a story is deleted.
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('profile-media', 'profile-media', true),
  ('story-media', 'story-media', true)
on conflict (id) do nothing;

create policy "public read profile media" on storage.objects
  for select using (bucket_id = 'profile-media');

create policy "public read story media" on storage.objects
  for select using (bucket_id = 'story-media');

comment on table storage.buckets is
  'listing-photos, report-photos, showroom-licenses, profile-media, story-media.';
