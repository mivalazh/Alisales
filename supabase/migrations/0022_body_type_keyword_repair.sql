-- ============================================================================
-- 0022 — Repair body classes written from two unsafe keywords
--
-- 0016 inferred a body class from the model and stored it in
-- `vehicles.body_type`. Two of its keywords are matched as substrings and fire
-- on models that are not that body at all:
--
--   · hatchback «500»  — «Mercedes S 500», «Mercedes-Benz S 500», «GLE 500»;
--   · pickup    «ram»  — any model whose text happens to contain r-a-m.
--
-- The shared table (`BODY_TYPE_HINTS`) now drops the bare «500» (the Fiat is
-- matched as «fiat 500») and names the Ram pickups by model («ram 1500», …), so
-- new writes infer correctly. 0016 itself is applied history — `supabase db
-- push` never runs it again — and the class is a stored column that the SQL
-- search filters on, so every row it wrote keeps its wrong class: an S 500
-- stays a hatchback and shows under هاچبک for ever.
--
-- This migration clears only what those two keywords produced — a car is reset
-- when its model matches a retired keyword and no current hint for the same
-- class explains it — and then re-runs the current inference, so a «GLE 500»
-- lands on suv (the `gle` hint) and an «S 500» becomes unknown rather than a
-- guess. A class a seller picked that the retired keywords did not imply is
-- never touched: the reset is keyed on the model text, not on the column alone.
--
-- Additive and idempotent: the reset is guarded by the same model match, and
-- the inference only ever fills `body_type is null`, exactly like 0016.
-- ============================================================================

do $$
declare
  rule record;
begin
  -- 1. Retire the classes the two removed keywords produced.
  update public.vehicles v
  set body_type = null
  where v.category = 'car'
    and (
      (
        v.body_type = 'hatchback'
        and v.model ilike '%500%'
        and v.model not ilike '%fiat 500%'
        -- Another hatchback hint may explain the stored class honestly.
        and not exists (
          select 1
          from unnest(array['golf', 'cooper', 'picanto', '206', '207', 'panda', 'corsa', 'i20']) as keyword
          where v.model ilike '%' || keyword || '%'
        )
      )
      or (
        v.body_type = 'pickup'
        and v.model ilike '%ram%'
        -- The named Ram models are still pickups (the current hints).
        and not exists (
          select 1
          from unnest(array['ram 1500', 'ram 2500', 'ram 3500', 'ram trx']) as keyword
          where v.model ilike '%' || keyword || '%'
        )
        and not exists (
          select 1
          from unnest(array['hilux', 'f-150', 'f150', 'silverado', 'l200', 'gladiator', 'tundra']) as keyword
          where v.model ilike '%' || keyword || '%'
        )
      )
    );

  -- 2. Re-infer with the current table (mirrors BODY_TYPE_HINTS).
  for rule in
    select *
    from (values
      ('pickup', array['hilux', 'f-150', 'f150', 'ram 1500', 'ram 2500', 'ram 3500', 'ram trx', 'silverado', 'l200', 'gladiator', 'tundra']),
      ('van', array['v-class', 'v class', 'odyssey', 'sienna', 'carnival', 'transporter']),
      ('convertible', array['boxster', 'convertible', 'cabriolet', 'spyder', 'roadster']),
      ('coupe', array['supra', '370z', 'gt-r', 'gtr', 'amg gt', '911', 'cayman', 'huracan', 'aventador', '720s', '570s', 'artura', '765lt', '488', 'f8', 'roma', 'portofino', 'sf90', 'db11', 'vantage', 'dbs', 'rapide', 'mustang', 'camaro', 'corvette', 'challenger', 'charger']),
      ('suv', array['land cruiser', 'prado', 'patrol', 'x5', 'x6', 'x7', 'x1', 'x3', 'gle', 'gls', 'glc', 'g-class', 'rx', 'nx', 'gx', 'lx', 'qx', 'cayenne', 'macan', 'touareg', 'tiguan', 'x-trail', 'qashqai', 'cr-v', 'pilot', 'hr-v', 'cx-5', 'cx-9', 'outlander', 'pajero', 'forester', 'outback', 'xv', 'xc40', 'xc60', 'xc90', 'range rover', 'defender', 'discovery', 'evoque', 'velar', 'escalade', 'tahoe', 'explorer', 'expedition', 'bronco', 'wrangler', 'grand cherokee', 'compass', 'cherokee', 'tucson', 'santa fe', 'palisade', 'kona', 'sportage', 'sorento', 'telluride', 'tiggo', 'h6', 'h9', 'jolion', 'dargo', 'coolray', 'tugella', 'okavango', 'atlas', 'cs35', 'cs55', 'cs75', 'uni-t', 'x50', 'x60', 'x70', 's3', 's5', 'j4', 't8', 'urus', 'bentayga', 'cullinan', 'dbx', 'qx80']),
      ('hatchback', array['golf', 'cooper', 'picanto', '206', '207', 'panda', 'fiat 500', 'corsa', 'i20']),
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
