-- ============================================================================
-- Alisales — 0021 reconcile photo buckets with the storage inventory
--
-- 0019 records the bucket with every photo row, and labels every row that
-- existed when it ran as `listing-photos`. That is right for objects uploaded
-- before 0018, but wrong in two cases:
--
--   · an object uploaded to `photos` between 0018 and 0019 — 0019 labels it
--     `listing-photos`, where no such file exists;
--   · a row written without an explicit bucket (an older client, a manual
--     import) takes the `photos` default while its object still lives in
--     `listing-photos`.
--
-- Either way the row builds a public URL for a bucket that has no such object,
-- which is a cover that renders as nothing. The database is the thing that
-- knows where the object is, so this reconciles the column with it: a row moves
-- only when its object is missing from the bucket it names *and* present in the
-- other one.
--
-- Rows whose object exists in both buckets (after scripts/copy-legacy-photos.mjs
-- copied them) or in neither (fixture rows, objects removed outside the app)
-- keep their label: both URLs work in the first case, and no URL works in the
-- second, so moving the label would only churn rows.
--
-- Idempotent, and safe to run on a project that never applied 0019.
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listing_photos'
      and column_name = 'bucket'
  ) then
    raise notice '0021: listing_photos.bucket is absent (0019 not applied) — nothing to reconcile';
    return;
  end if;

  -- The object is only in the legacy bucket: the row must follow it there.
  update public.listing_photos lp
  set bucket = 'listing-photos'
  where lp.bucket = 'photos'
    and not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'photos'
        and o.name = lp.storage_path
    )
    and exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'listing-photos'
        and o.name = lp.storage_path
    );

  -- And the mirror case: an object that only exists in the current bucket.
  update public.listing_photos lp
  set bucket = 'photos'
  where lp.bucket = 'listing-photos'
    and not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'listing-photos'
        and o.name = lp.storage_path
    )
    and exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'photos'
        and o.name = lp.storage_path
    );
end
$$;
