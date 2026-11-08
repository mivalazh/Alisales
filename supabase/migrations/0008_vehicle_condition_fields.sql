-- Seller-declared condition facts collected by the web listing form.
-- These are detail-only: the catalogue cards must stay uncluttered, so they are
-- deliberately not added to the public.listing_cards view or search RPC yet.

alter table public.vehicles
  add column if not exists third_party_insurance boolean,
  add column if not exists third_party_months smallint
    check (third_party_months is null or third_party_months between 1 and 12),
  add column if not exists body_insurance boolean,
  add column if not exists body_months smallint
    check (body_months is null or body_months between 1 and 12),
  add column if not exists paint_condition text,
  add column if not exists chassis_condition text,
  add column if not exists technical_inspection boolean,
  add column if not exists is_journal_photo boolean not null default false,
  add column if not exists inspection_sheet_url text,
  add column if not exists inspection_note text;

alter table public.vehicles
  add constraint vehicles_paint_condition_check
    check (
      paint_condition is null
      or paint_condition in (
        'factory', 'minor_scratches', 'one_spot', 'few_spots',
        'partial_repaint', 'full_repaint', 'stock_replaced', 'accident'
      )
    ),
  add constraint vehicles_chassis_condition_check
    check (
      chassis_condition is null
      or chassis_condition in ('sealed', 'front_damaged', 'rear_damaged', 'both_damaged')
    );

comment on column public.vehicles.is_journal_photo is
  'Cover came from a catalogue/internet source; shown as «عکس ژورنال» in the detail specs.';
comment on column public.vehicles.inspection_sheet_url is
  'Optional seller-uploaded inspection report; buyer-initiated workshop inspection stays separate.';
