-- ============================================================================
-- Alisales — seed_fixtures.sql  ⚠ LOCAL / TEST USE ONLY (never production)
-- Creates auth.users stubs (PGlite) + demo accounts, showroom, subscription
-- and the seeded listings every DB test builds on.
--
-- Accounts:
--   ...0a admin, ...0b inspector, ...0c alice (individual), ...0d bob
--   (showroom owner), ...0e carol (showroom editor), ...0f dave (buyer)
-- ============================================================================

insert into auth.users (id, phone) values
  ('00000000-0000-0000-0000-00000000000a', '+989000000001'),
  ('00000000-0000-0000-0000-00000000000b', '+989000000002'),
  ('00000000-0000-0000-0000-00000000000c', '+989000000003'),
  ('00000000-0000-0000-0000-00000000000d', '+989000000004'),
  ('00000000-0000-0000-0000-00000000000e', '+989000000005'),
  ('00000000-0000-0000-0000-00000000000f', '+989000000006')
on conflict (id) do nothing;

insert into public.users (id, phone, display_name, role) values
  ('00000000-0000-0000-0000-00000000000a', '+989000000001', 'مدیر سامانه', 'admin'),
  ('00000000-0000-0000-0000-00000000000b', '+989000000002', 'بازرس کارگاه', 'inspector'),
  ('00000000-0000-0000-0000-00000000000c', '+989000000003', 'علی مشتری', 'individual'),
  ('00000000-0000-0000-0000-00000000000d', '+989000000004', 'بابک نمایشگاه', 'individual'),
  ('00000000-0000-0000-0000-00000000000e', '+989000000005', 'کارمند نمایشگاه', 'individual'),
  ('00000000-0000-0000-0000-00000000000f', '+989000000006', 'داوود خریدار', 'individual')
on conflict (id) do nothing;

insert into public.showrooms
  (id, owner_id, slug, name, city, phone, license_status, is_verified)
values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-00000000000d',
   'kish-auto', 'اتومبیل کیش', 'kish', '+989012345678', 'approved', true)
on conflict (id) do nothing;

insert into public.showroom_staff (showroom_id, user_id, role) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-00000000000d', 'owner'),
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-00000000000e', 'editor')
on conflict do nothing;

-- Showroom has a live Basic subscription (8M IRR → limit 10, priority 1)
insert into public.subscriptions
  (id, showroom_id, plan_id, status, period_start, period_end)
select
  '00000000-0000-0000-0000-000000000020',
  '00000000-0000-0000-0000-000000000010',
  pl.id, 'active', now() - interval '10 days', now() + interval '20 days'
from public.subscription_plans pl where pl.code = 'basic'
on conflict do nothing;

-- ── Vehicles ────────────────────────────────────────────────────────────────
insert into public.vehicles (id, created_by, brand, model, trim, year, mileage_km, gearbox, fuel, color, condition, plate_type, vin) values
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-00000000000d', 'saipa', 'کوییک', 'S', 1402, 32000, 'manual', 'petrol', 'white', 'used', 'standard', null),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-00000000000d', 'ikco', 'پژو ۲۰۶', null, 1401, 58000, 'manual', 'petrol', 'silver', 'used', 'kish', null),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-00000000000d', 'saipa', 'شاهین', null, 1403, 0, 'automatic', 'petrol', 'white', 'new', 'standard', null),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-00000000000d', 'ikco', 'دنا پلاس', 'اتوماتیک', 1402, 24000, 'automatic', 'petrol', 'gray', 'used', 'standard', null),
  ('00000000-0000-0000-0000-000000000034', '00000000-0000-0000-0000-00000000000d', 'saipa', 'کوییک', 'R', 1402, 41000, 'manual', 'petrol', 'red', 'used', 'temporary_transit', null),
  ('00000000-0000-0000-0000-000000000035', '00000000-0000-0000-0000-00000000000d', 'ikco', 'پژو ۲۰۶', null, 1400, 76000, 'manual', 'petrol', 'blue', 'used', 'kish', null),
  ('00000000-0000-0000-0000-000000000036', '00000000-0000-0000-0000-00000000000d', 'ikco', 'پژو ۲۰۶', null, 1401, 61000, 'manual', 'petrol', 'black', 'used', 'standard', null),
  ('00000000-0000-0000-0000-000000000037', '00000000-0000-0000-0000-00000000000c', 'ikco', 'پژو ۲۰۶', null, 1398, 128000, 'manual', 'petrol', 'white', 'used', 'kish', null),
  ('00000000-0000-0000-0000-000000000038', '00000000-0000-0000-0000-00000000000c', 'saipa', 'تیبا', null, 1400, 90000, 'manual', 'petrol', 'silver', 'used', 'standard', null)
on conflict (id) do nothing;

-- ── Listings (created_at backdated so rate-limit windows stay clean) ───────
insert into public.listings
  (id, slug, created_by, showroom_id, vehicle_id, price_irr, city, description, state,
   featured, allow_phone_reveal, report_id, published_at, created_at)
values
  -- showroom: active Kish-plate 206 WITH finalized report + featured slot
  ('00000000-0000-0000-0000-000000000041', 'peugeot-206-showroom', '00000000-0000-0000-0000-00000000000d',
   '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000031',
   1100000000000, 'kish', 'پژو ۲۰۶ سالم، دارای گزارش بازرسی معتبر کارگاه.', 'active',
   true, false, null, now() - interval '3 days', now() - interval '3 days'),
  -- showroom: active standard Kish car
  ('00000000-0000-0000-0000-000000000040', 'kiaqi-kish-showroom', '00000000-0000-0000-0000-00000000000d',
   '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000030',
   900000000000, 'kish', 'کوییک S مدل ۱۴۰۲، کارکرد پایین.', 'active',
   false, false, null, now() - interval '2 days', now() - interval '2 days'),
  -- showroom: active new Shahin in Tehran (automatic, new)
  ('00000000-0000-0000-0000-000000000042', 'shahin-new-tehran', '00000000-0000-0000-0000-00000000000d',
   '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000032',
   1800000000000, 'tehran', 'شاهین صفر کیلومتر، بدون کارکرد.', 'active',
   false, false, null, now() - interval '1 day', now() - interval '1 day'),
  -- showroom: active temporary-transit Kioqi (median-segment filler)
  ('00000000-0000-0000-0000-000000000044', 'kioqi-transit', '00000000-0000-0000-0000-00000000000d',
   '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000034',
   880000000000, 'kish', 'کوییک R گذر موقت، وضعیت پلاک توسط فروشنده اعلام شده است.', 'active',
   false, false, null, now() - interval '1 day', now() - interval '1 day'),
  -- showroom: active 206 (segment filler 1)
  ('00000000-0000-0000-0000-000000000045', 'peugeot-206-blue-kish', '00000000-0000-0000-0000-00000000000d',
   '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000035',
   1050000000000, 'kish', 'پژو ۲۰۶ آبی متالیک، پلاک کیش.', 'active',
   false, false, null, now() - interval '4 days', now() - interval '4 days'),
  -- showroom: active 206 (segment filler 2)
  ('00000000-0000-0000-0000-000000000046', 'peugeot-206-black-tehran', '00000000-0000-0000-0000-00000000000d',
   '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000036',
   1150000000000, 'tehran', 'پژو ۲۰۶ مشکی، سالم.', 'active',
   false, false, null, now() - interval '5 days', now() - interval '5 days'),
  -- showroom: SOLD — must not be public
  ('00000000-0000-0000-0000-000000000043', 'dena-plus-sold', '00000000-0000-0000-0000-00000000000d',
   '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000033',
   2400000000000, 'kish', 'دنا پلاس فروخته شد.', 'sold',
   false, false, null, now() - interval '10 days', now() - interval '10 days'),
  -- individual (alice): active 206 (consumes 1 of her 2 free slots)
  ('00000000-0000-0000-0000-000000000047', 'peugeot-206-alice', '00000000-0000-0000-0000-00000000000c',
   null, '00000000-0000-0000-0000-000000000037',
   1000000000000, 'kish', 'پژو ۲۰۶ مدل ۱۳۹۸، تک‌رنگ، قابل معاوضه.', 'active',
   false, false, null, now() - interval '2 days', now() - interval '2 days'),
  -- individual (alice): DRAFT — consumes her 2nd slot, never public
  ('00000000-0000-0000-0000-000000000048', 'tiba-alice-draft', '00000000-0000-0000-0000-00000000000c',
   null, '00000000-0000-0000-0000-000000000038',
   700000000000, 'kish', 'تیبا در انتظار تکمیل اطلاعات.', 'draft',
   false, false, null, null, now() - interval '2 hours')
on conflict (id) do nothing;

-- hidden-by-moderation example: showroom re-lists Samand then hides it
insert into public.vehicles (id, created_by, brand, model, year, mileage_km, gearbox, fuel, color, condition, plate_type)
values ('00000000-0000-0000-0000-000000000039', '00000000-0000-0000-0000-00000000000d',
        'ikco', 'سمند LX', 1397, 150000, 'manual', 'petrol', 'white', 'used', 'standard')
on conflict (id) do nothing;

insert into public.listings
  (id, slug, created_by, showroom_id, vehicle_id, price_irr, city, description, state, published_at, created_at)
values
  ('00000000-0000-0000-0000-000000000049', 'samaned-hidden', '00000000-0000-0000-0000-00000000000d',
   '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000039',
   850000000000, 'kish', 'پنهان‌شده به دلیل گزارش‌های متعدد.', 'active',
   now() - interval '6 days', now() - interval '6 days')
on conflict (id) do nothing;

update public.listings
  set hidden_at = now() - interval '1 day', hidden_reason = 'abuse_threshold'
  where id = '00000000-0000-0000-0000-000000000049';

-- ── Cover photos ────────────────────────────────────────────────────────────
insert into public.listing_photos (listing_id, storage_path, position, mime, bytes, width, height) values
  ('00000000-0000-0000-0000-000000000040', 'showroom/40/0.webp', 0, 'image/webp', 220000, 1600, 1200),
  ('00000000-0000-0000-0000-000000000041', 'showroom/41/0.webp', 0, 'image/webp', 210000, 1600, 1200),
  ('00000000-0000-0000-0000-000000000047', 'alice/47/0.webp', 0, 'image/webp', 200000, 1600, 1200)
on conflict do nothing;

-- ── Finalized inspection report attached to the featured 206 ───────────────
insert into public.inspection_reports
  (id, listing_id, inspector_id, brand, model, year, vin, mileage_km, status, current_version, final_hash, finalized_at)
values
  ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000041',
   '00000000-0000-0000-0000-00000000000b', 'ikco', 'پژو ۲۰۶', 1401, null, 58000,
   'finalized', 1, repeat('ab', 32), now() - interval '2 days')
on conflict (id) do nothing;

update public.listings
  set report_id = '00000000-0000-0000-0000-000000000050'
  where id = '00000000-0000-0000-0000-000000000041';

insert into public.report_versions (id, report_id, version, content, content_hash, created_by, finalized) values
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000050', 1,
   '{
      "identity": {"brand": "ikco", "model": "پژو ۲۰۶", "year": 1401, "vin": null},
      "mileageKm": 58000,
      "engine": {"condition": "good", "notes": "روغن‌ریزی ندارد"},
      "panels": [
        {"panel": "hood", "condition": "original"},
        {"panel": "roof", "condition": "original"},
        {"panel": "front_bumper", "condition": "repainted"}
      ],
      "accidentHistory": [],
      "replacedParts": [],
      "inspectorNotes": "خودروی سالم؛ سپر جلو رنگ‌آمیزی شده است.",
      "date": "2026-10-18"
    }'::jsonb,
   repeat('cd', 32),
   '00000000-0000-0000-0000-00000000000b', true)
on conflict do nothing;

insert into public.report_photos (report_version_id, slot, position, storage_path, mime, bytes) values
  ('00000000-0000-0000-0000-000000000051', 'exterior_front', 0, 'inspector/50/front.webp', 'image/webp', 180000),
  ('00000000-0000-0000-0000-000000000051', 'odometer', 0, 'inspector/50/odometer.webp', 'image/webp', 120000),
  ('00000000-0000-0000-0000-000000000051', 'engine_bay', 0, 'inspector/50/engine.webp', 'image/webp', 160000)
on conflict do nothing;
