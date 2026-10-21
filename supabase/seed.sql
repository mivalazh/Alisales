-- ============================================================================
-- Alisales — seed (safe on Supabase and PGlite): subscription plans.
--
-- ⚠ PRICING GATE — legally reviewed values; do not change without sign-off:
--   free  (individuals): 0 IRR,        2 concurrent listings
--   basic (showrooms):   8,000,000 IRR/mo → 10 listings, 1 featured, 1 inspection, priority 1
--   pro   (showrooms):   20,000,000 IRR/mo → 40 listings, 5 featured, 3 inspections, priority 2
-- ============================================================================

insert into public.subscription_plans
  (code, name, price_irr, listing_limit, featured_slots, free_inspections_per_month, search_priority, is_active)
values
  ('free',  'رایگان (اشخاص)', 0,         2,  0, 0, 0, true),
  ('basic', 'پایه',            8000000,  10,  1, 1, 1, true),
  ('pro',   'حرفه‌ای',         20000000, 40,  5, 3, 2, true)
on conflict (code) do update
  set name = excluded.name,
      price_irr = excluded.price_irr,
      listing_limit = excluded.listing_limit,
      featured_slots = excluded.featured_slots,
      free_inspections_per_month = excluded.free_inspections_per_month,
      search_priority = excluded.search_priority,
      is_active = excluded.is_active;
