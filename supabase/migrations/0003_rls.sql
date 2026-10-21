-- ============================================================================
-- Alisales — 0003 row level security
-- Matrix:
--   public      → active (unhidden) listings w/ live showroom subscription,
--                 finalized inspection reports, plan prices, showroom profiles
--   owners      → their own rows (listings, vehicles, photos, conversations)
--   showroom staff (owner/editor) → their showroom's listings
--   inspectors  → only reports they own
--   admins      → moderate everything
-- ============================================================================

alter table public.users enable row level security;
alter table public.showrooms enable row level security;
alter table public.showroom_staff enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.vehicles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_photos enable row level security;
alter table public.inspection_reports enable row level security;
alter table public.report_versions enable row level security;
alter table public.report_photos enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.abuse_reports enable row level security;

-- ── Grants (RLS narrows what these allow) ───────────────────────────────────
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant select on public.listing_cards to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- ── users ───────────────────────────────────────────────────────────────────
create policy users_select_own_or_admin on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy users_insert_self_individual on public.users
  for insert to authenticated
  with check (id = auth.uid() and role = 'individual');

create policy users_update_own on public.users
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy users_delete_own_or_admin on public.users
  for delete to authenticated
  using (id = auth.uid() or public.is_admin());

-- ── showrooms (public business profiles; license docs column-restricted) ────
revoke select on public.showrooms from anon, authenticated;
grant select (id, slug, name, city, phone, description, license_status, is_verified, created_at)
  on public.showrooms to anon, authenticated;

create policy showrooms_select_public on public.showrooms
  for select using (true);

create policy showrooms_insert_own on public.showrooms
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy showrooms_update_owner_or_admin on public.showrooms
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create policy showrooms_delete_owner_or_admin on public.showrooms
  for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- ── showroom_staff ──────────────────────────────────────────────────────────
create policy showroom_staff_select_self_owner_admin on public.showroom_staff
  for select to authenticated
  using (user_id = auth.uid() or public.is_showroom_owner(showroom_id, auth.uid()) or public.is_admin());

create policy showroom_staff_insert_owner_admin on public.showroom_staff
  for insert to authenticated
  with check (public.is_showroom_owner(showroom_id, auth.uid()) or public.is_admin());

create policy showroom_staff_update_owner_admin on public.showroom_staff
  for update to authenticated
  using (public.is_showroom_owner(showroom_id, auth.uid()) or public.is_admin())
  with check (public.is_showroom_owner(showroom_id, auth.uid()) or public.is_admin());

create policy showroom_staff_delete_owner_admin on public.showroom_staff
  for delete to authenticated
  using (public.is_showroom_owner(showroom_id, auth.uid()) or public.is_admin());

-- ── subscription_plans (public price list; admin-managed) ───────────────────
create policy subscription_plans_select_public on public.subscription_plans
  for select using (true);

create policy subscription_plans_admin_all on public.subscription_plans
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── subscriptions ───────────────────────────────────────────────────────────
create policy subscriptions_select_owner on public.subscriptions
  for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or (showroom_id is not null and public.is_showroom_owner(showroom_id, auth.uid()))
  );

create policy subscriptions_update_owner_on_admin on public.subscriptions
  for update to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or (showroom_id is not null and public.is_showroom_owner(showroom_id, auth.uid()))
  )
  with check (
    public.is_admin()
    or user_id = auth.uid()
    or (showroom_id is not null and public.is_showroom_owner(showroom_id, auth.uid()))
  );

-- Inserts/term changes come only from server code (service role) or admins.
create policy subscriptions_admin_insert on public.subscriptions
  for insert to authenticated
  with check (public.is_admin());

-- ── subscription_payments (read-only ledger for account owners) ────────────
create policy subscription_payments_select_owner on public.subscription_payments
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.subscriptions s
      where s.id = subscription_id
        and (s.user_id = auth.uid()
             or (s.showroom_id is not null and public.is_showroom_owner(s.showroom_id, auth.uid())))
    )
  );

-- ── vehicles ────────────────────────────────────────────────────────────────
create policy vehicles_select_owner_admin_public_listing on public.vehicles
  for select
  using (
    created_by = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.listings l
      where l.vehicle_id = vehicles.id and public.is_listing_public(l.id)
    )
  );

create policy vehicles_insert_self on public.vehicles
  for insert to authenticated
  with check (created_by = auth.uid());

create policy vehicles_update_owner_or_admin on public.vehicles
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create policy vehicles_delete_owner_or_admin on public.vehicles
  for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- ── listings ────────────────────────────────────────────────────────────────
create policy listings_select_public_owner_staff_admin on public.listings
  for select
  using (
    public.is_listing_public(id)
    or created_by = auth.uid()
    or (showroom_id is not null and public.is_showroom_staff(showroom_id, auth.uid()))
    or public.is_admin()
  );

create policy listings_insert_owner_draft on public.listings
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and state in ('draft', 'pending_review')
    and (showroom_id is null or public.is_showroom_staff(showroom_id, auth.uid()))
  );

create policy listings_update_owner_staff_admin on public.listings
  for update to authenticated
  using (
    created_by = auth.uid()
    or (showroom_id is not null and public.is_showroom_staff(showroom_id, auth.uid()))
    or public.is_admin()
  )
  with check (
    created_by = auth.uid()
    or (showroom_id is not null and public.is_showroom_staff(showroom_id, auth.uid()))
    or public.is_admin()
  );

create policy listings_delete_owner_staff_admin on public.listings
  for delete to authenticated
  using (
    created_by = auth.uid()
    or (showroom_id is not null and public.is_showroom_staff(showroom_id, auth.uid()))
    or public.is_admin()
  );

-- ── listing_photos (follow the parent listing's visibility/ownership) ──────
create policy listing_photos_select_follow_listing on public.listing_photos
  for select
  using (exists (select 1 from public.listings l where l.id = listing_id));

create policy listing_photos_write_listing_owner on public.listing_photos
  for insert to authenticated
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (l.created_by = auth.uid()
             or (l.showroom_id is not null and public.is_showroom_staff(l.showroom_id, auth.uid())))
    )
    or public.is_admin()
  );

create policy listing_photos_update_listing_owner on public.listing_photos
  for update to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (l.created_by = auth.uid()
             or (l.showroom_id is not null and public.is_showroom_staff(l.showroom_id, auth.uid())))
    )
    or public.is_admin()
  )
  with check (
    exists (select 1 from public.listings l where l.id = listing_id)
    or public.is_admin()
  );

create policy listing_photos_delete_listing_owner on public.listing_photos
  for delete to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id
        and (l.created_by = auth.uid()
             or (l.showroom_id is not null and public.is_showroom_staff(l.showroom_id, auth.uid())))
    )
    or public.is_admin()
  );

-- ── inspection_reports ──────────────────────────────────────────────────────
create policy inspection_reports_select_finalized_or_owner on public.inspection_reports
  for select
  using (status = 'finalized' or inspector_id = auth.uid() or public.is_admin());

create policy inspection_reports_insert_inspector on public.inspection_reports
  for insert to authenticated
  with check (inspector_id = auth.uid() and public.has_role('inspector'));

create policy inspection_reports_update_owner_or_admin on public.inspection_reports
  for update to authenticated
  using (inspector_id = auth.uid() or public.is_admin())
  with check (inspector_id = auth.uid() or public.is_admin());

create policy inspection_reports_delete_admin on public.inspection_reports
  for delete to authenticated
  using (public.is_admin());

-- ── report_versions (append-only; no update/delete policies exist) ─────────
create policy report_versions_select_visible_report on public.report_versions
  for select
  using (exists (
    select 1 from public.inspection_reports r
    where r.id = report_id
      and (r.status = 'finalized' or r.inspector_id = auth.uid() or public.is_admin())
  ));

create policy report_versions_insert_own_report on public.report_versions
  for insert to authenticated
  with check (exists (
    select 1 from public.inspection_reports r
    where r.id = report_id and (r.inspector_id = auth.uid() or public.is_admin())
  ));

-- ── report_photos ───────────────────────────────────────────────────────────
create policy report_photos_select_visible_report on public.report_photos
  for select
  using (exists (
    select 1 from public.report_versions rv
    join public.inspection_reports r on r.id = rv.report_id
    where rv.id = report_version_id
      and (r.status = 'finalized' or r.inspector_id = auth.uid() or public.is_admin())
  ));

create policy report_photos_write_own_report on public.report_photos
  for insert to authenticated
  with check (exists (
    select 1 from public.report_versions rv
    join public.inspection_reports r on r.id = rv.report_id
    where rv.id = report_version_id and (r.inspector_id = auth.uid() or public.is_admin())
  ));

create policy report_photos_update_own_report on public.report_photos
  for update to authenticated
  using (exists (
    select 1 from public.report_versions rv
    join public.inspection_reports r on r.id = rv.report_id
    where rv.id = report_version_id and (r.inspector_id = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.report_versions rv
    join public.inspection_reports r on r.id = rv.report_id
    where rv.id = report_version_id and (r.inspector_id = auth.uid() or public.is_admin())
  ));

create policy report_photos_delete_own_report on public.report_photos
  for delete to authenticated
  using (exists (
    select 1 from public.report_versions rv
    join public.inspection_reports r on r.id = rv.report_id
    where rv.id = report_version_id and (r.inspector_id = auth.uid() or public.is_admin())
  ));

-- ── conversations ───────────────────────────────────────────────────────────
create policy conversations_select_participant on public.conversations
  for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

create policy conversations_insert_buyer_on_public_listing on public.conversations
  for insert to authenticated
  with check (
    buyer_id = auth.uid()
    and seller_id <> auth.uid()
    and exists (select 1 from public.listings l where l.id = listing_id and public.is_listing_public(l.id))
  );

create policy conversations_update_participant on public.conversations
  for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

create policy conversations_delete_participant_or_admin on public.conversations
  for delete to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

-- ── messages (immutable once sent) ──────────────────────────────────────────
create policy messages_select_participant on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid() or public.is_admin())
  ));

create policy messages_insert_participant on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- ── abuse_reports ───────────────────────────────────────────────────────────
create policy abuse_reports_select_reporter_or_admin on public.abuse_reports
  for select
  using (reporter_id = auth.uid() or public.is_admin());

create policy abuse_reports_insert_authenticated on public.abuse_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy abuse_reports_update_admin on public.abuse_reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy abuse_reports_delete_admin on public.abuse_reports
  for delete to authenticated
  using (public.is_admin());
