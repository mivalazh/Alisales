-- ============================================================================
-- 0016 — Recover the body class of hosted cars that never stored one.
--
-- `vehicles.body_type` arrived in 0014 and is nullable, so every car published
-- before it reads back with `body_type = null`, and 0015's category backfill
-- deliberately leaves the column alone. The web client already infers a class
-- from the model when the column is missing (`inferBodyType`), but the SQL
-- search cannot: `search_listings` filters on `c.body_type`, so a hosted
-- /cars request with a body-class filter never returns those rows at all.
--
-- This writes the same inference into the column, mirroring
-- `BODY_TYPE_HINTS` in packages/schemas/src/vehicle.ts — same keywords, same
-- order, first match wins (tests/body-type-hints-drift.test.ts pins the two
-- together). Only cars are touched: a motorcycle or a machine has no body
-- class, and an explicit seller pick is never overridden.
--
-- Additive and idempotent: every update is guarded by `body_type is null`, so
-- running it again changes nothing. A model no hint recognises stays null —
-- unknown, not a guess — and behaves exactly as before.
-- ============================================================================

do $$
declare
  rule record;
begin
  for rule in
    select *
    from (values
      ('pickup', array['hilux', 'f-150', 'f150', 'ram', 'silverado', 'l200', 'gladiator', 'tundra']),
      ('van', array['v-class', 'v class', 'odyssey', 'sienna', 'carnival', 'transporter']),
      ('convertible', array['boxster', 'convertible', 'cabriolet', 'spyder', 'roadster']),
      ('coupe', array['supra', '370z', 'gt-r', 'gtr', 'amg gt', '911', 'cayman', 'huracan', 'aventador', '720s', '570s', 'artura', '765lt', '488', 'f8', 'roma', 'portofino', 'sf90', 'db11', 'vantage', 'dbs', 'rapide', 'mustang', 'camaro', 'corvette', 'challenger', 'charger']),
      ('suv', array['land cruiser', 'prado', 'patrol', 'x5', 'x6', 'x7', 'x1', 'x3', 'gle', 'gls', 'glc', 'g-class', 'rx', 'nx', 'gx', 'lx', 'qx', 'cayenne', 'macan', 'touareg', 'tiguan', 'x-trail', 'qashqai', 'cr-v', 'pilot', 'hr-v', 'cx-5', 'cx-9', 'outlander', 'pajero', 'forester', 'outback', 'xv', 'xc40', 'xc60', 'xc90', 'range rover', 'defender', 'discovery', 'evoque', 'velar', 'escalade', 'tahoe', 'explorer', 'expedition', 'bronco', 'wrangler', 'grand cherokee', 'compass', 'cherokee', 'tucson', 'santa fe', 'palisade', 'kona', 'sportage', 'sorento', 'telluride', 'tiggo', 'h6', 'h9', 'jolion', 'dargo', 'coolray', 'tugella', 'okavango', 'atlas', 'cs35', 'cs55', 'cs75', 'uni-t', 'x50', 'x60', 'x70', 's3', 's5', 'j4', 't8', 'urus', 'bentayga', 'cullinan', 'dbx', 'qx80']),
      ('hatchback', array['golf', 'cooper', 'picanto', '206', '207', 'panda', '500', 'corsa', 'i20']),
      ('sedan', array['camry', 'corolla', 'accord', 'civic', 'mazda 3', 'mazda 6', 's-class', 'e-class', 'c-class', '3 series', '5 series', '7 series', 'a4', 'a6', 'a8', 'passat', 's60', 's90', 'xe', 'xf', 'ghibli', 'quattroporte', 'ct4', 'ct5', 'malibu', 'sonata', 'elantra', 'accent', 'optima', 'k5', 'cerato', 'stinger', 'g70', 'g80', 'g90', 'mg5', 'mg6', 'arrizo', 'tondar', 'altima', 'maxima'])
    ) as t(body, hints)
  loop
    update public.vehicles v
    set body_type = rule.body
    where v.body_type is null
      and v.category = 'car'
      and exists (
        select 1
        from unnest(rule.hints) as keyword
        where v.model ilike '%' || keyword || '%'
      );
  end loop;
end
$$;
