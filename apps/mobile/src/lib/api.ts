import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  isSlotState,
  type BrandSlug,
  type ColorSlug,
  type Condition,
  type Fuel,
  type Gearbox,
  type ListingPhoto,
  type ListingPublish,
  type ListingState,
  type PlateType,
} from '@alisales/schemas';
import type { ProcessedPhoto } from './photos';

/**
 * Mobile data layer.
 *
 * - No EXPO_PUBLIC_SUPABASE_* credentials → local demo store (in-memory, wiped
 *   on app restart) so CRUD screens are fully reviewable — same convention as
 *   the web app's fixture mode (.env.example documents both).
 * - Credentials present → real Supabase tables with RLS (Phase 1). Reads of
 *   "my listings" return only the signed-in owner's rows; mutations require a
 *   session (`created_by` has no DB default), so pre-auth they surface the
 *   Persian message «ابتدا وارد حساب شوید» — auth itself lands in Phase 4.
 */

export interface MyListing {
  id: string;
  slug: string;
  priceIRR: number;
  state: ListingState;
  publishedAt: string | null;
  /** Full editable payload — hydrates the edit form. */
  draft: ListingPublish;
  /**
   * Locally processed photo files from this session (demo mode previews).
   * Undefined when the listing's photos live only as stored metadata (their
   * storage upload is wired in Phase 4 alongside auth).
   */
  localPhotos?: ProcessedPhoto[];
}

export const isDemoMode = !(
  process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

let demo: MyListing[] | null = null;

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function seedDemo(): MyListing[] {
  return [
    {
      id: 'local-206',
      slug: 'peugeot-206-alice',
      priceIRR: 1_000_000_000_000,
      state: 'active',
      publishedAt: daysAgo(2),
      draft: {
        vehicle: {
          brand: 'ikco' as BrandSlug,
          model: 'پژو ۲۰۶',
          trim: null,
          year: 1398,
          mileageKm: 128_000,
          gearbox: 'manual' as Gearbox,
          fuel: 'petrol' as Fuel,
          color: 'white' as ColorSlug,
          condition: 'used' as Condition,
          plateType: 'kish' as PlateType,
          vin: null,
        },
        priceIRR: 1_000_000_000_000,
        city: 'kish',
        description: 'پژو ۲۰۶ مدل ۱۳۹۸، تک‌رنگ، قابل معاوضه.',
        photos: [],
        showroomId: null,
        allowPhoneReveal: false,
      },
    },
    {
      id: 'local-tiba',
      slug: 'tiba-alice-draft',
      priceIRR: 700_000_000_000,
      state: 'draft',
      publishedAt: null,
      draft: {
        vehicle: {
          brand: 'saipa' as BrandSlug,
          model: 'تیبا',
          trim: null,
          year: 1400,
          mileageKm: 90_000,
          gearbox: 'manual' as Gearbox,
          fuel: 'petrol' as Fuel,
          color: 'silver' as ColorSlug,
          condition: 'used' as Condition,
          plateType: 'standard' as PlateType,
          vin: null,
        },
        priceIRR: 700_000_000_000,
        city: 'kish',
        description: 'تیبا در انتظار تکمیل اطلاعات.',
        photos: [],
        showroomId: null,
        allowPhoneReveal: false,
      },
    },
  ];
}

function store(): MyListing[] {
  if (!demo) demo = seedDemo();
  return demo;
}

// ── Supabase branch ──────────────────────────────────────────────────────────

function client(): SupabaseClient {
  return createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const LISTING_SELECT = `
  id, slug, price_irr, state, published_at, description, city, allow_phone_reveal,
  vehicle:vehicles (
    brand, model, trim, year, mileage_km, gearbox, fuel, color, condition, plate_type, vin
  ),
  photos:listing_photos (path, mime, bytes, width, height, position)
`;

interface ListingRow {
  id: string;
  slug: string;
  price_irr: string | number;
  state: ListingState;
  published_at: string | null;
  description: string;
  city: string;
  allow_phone_reveal: boolean;
  vehicle: {
    brand: BrandSlug;
    model: string;
    trim: string | null;
    year: number;
    mileage_km: number;
    gearbox: Gearbox;
    fuel: Fuel;
    color: ColorSlug;
    condition: Condition;
    plate_type: PlateType;
    vin: string | null;
  } | null;
  photos: ListingPhoto[] | null;
}

const PERSIAN_DB_ERRORS: Record<string, string> = {
  plan_limit: 'به سقف آگهی‌های طرح خود رسیده‌اید؛ برای ادامه، طرح بخرید.',
  rate_limit: 'تعداد آگهی در ساعت مجاز نیست؛ کمی بعد دوباره تلاش کنید.',
};

function mapDbError(message: string | undefined): Error {
  const raw = message ?? '';
  for (const [key, text] of Object.entries(PERSIAN_DB_ERRORS)) {
    if (raw.includes(key)) return new Error(text);
  }
  if (raw.includes('42501') || raw.toLowerCase().includes('row-level security')) {
    return new Error('برای دسترسی به آگهی‌های خود ابتدا وارد حساب شوید.');
  }
  return new Error('خطایی در ذخیره‌سازی رخ داد؛ لطفاً دوباره تلاش کنید.');
}

async function requireUserId(c: SupabaseClient): Promise<string> {
  const { data, error } = await c.auth.getUser();
  if (error || !data.user) {
    throw new Error('برای ثبت آگهی ابتدا وارد حساب خود شوید.');
  }
  return data.user.id;
}

function rowToMyListing(row: ListingRow): MyListing {
  if (!row.vehicle) throw new Error('اطلاعات خودروی آگهی یافت نشد.');
  const v = row.vehicle;
  return {
    id: row.id,
    slug: row.slug,
    priceIRR: Number(row.price_irr),
    state: row.state,
    publishedAt: row.published_at,
    draft: {
      vehicle: {
        brand: v.brand,
        model: v.model,
        trim: v.trim,
        year: v.year,
        mileageKm: v.mileage_km,
        gearbox: v.gearbox,
        fuel: v.fuel,
        color: v.color,
        condition: v.condition,
        plateType: v.plate_type,
        vin: v.vin,
      },
      priceIRR: Number(row.price_irr),
      city: row.city,
      description: row.description,
      photos: (row.photos ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((p) => ({
          path: p.path,
          mime: p.mime,
          bytes: p.bytes,
          width: p.width,
          height: p.height,
          position: p.position,
        })),
      showroomId: null,
      allowPhoneReveal: row.allow_phone_reveal,
    },
  };
}

// ── Public API (React Query hooks call these) ────────────────────────────────

export async function fetchMyListings(): Promise<MyListing[]> {
  if (isDemoMode) return store();

  const c = client();
  let query = c
    .from('listings')
    .select(LISTING_SELECT)
    .order('created_at', { ascending: false });
  query = query.order('position', {
    referencedTable: 'listing_photos',
    ascending: true,
  });
  const { data, error } = await query;
  if (error) throw mapDbError(error.message);
  return (data as unknown as ListingRow[]).map(rowToMyListing);
}

export async function fetchListing(id: string): Promise<MyListing | null> {
  if (isDemoMode) return store().find((l) => l.id === id) ?? null;

  const c = client();
  const { data, error } = await c
    .from('listings')
    .select(LISTING_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw mapDbError(error.message);
  return data ? rowToMyListing(data as unknown as ListingRow) : null;
}

export async function createListing(
  payload: ListingPublish,
  localPhotos?: ProcessedPhoto[],
): Promise<MyListing> {
  if (isDemoMode) {
    const listing: MyListing = {
      id: `local-${Date.now().toString(36)}`,
      slug: `local-${Date.now().toString(36)}`,
      priceIRR: payload.priceIRR,
      state: 'pending_review',
      publishedAt: null,
      draft: payload,
      localPhotos: localPhotos ?? [],
    };
    store().unshift(listing);
    return listing;
  }

  const c = client();
  const uid = await requireUserId(c);

  const { data: vehicle, error: vErr } = await c
    .from('vehicles')
    .insert({
      created_by: uid,
      brand: payload.vehicle.brand,
      model: payload.vehicle.model,
      trim: payload.vehicle.trim,
      year: payload.vehicle.year,
      mileage_km: payload.vehicle.mileageKm,
      gearbox: payload.vehicle.gearbox,
      fuel: payload.vehicle.fuel,
      color: payload.vehicle.color,
      condition: payload.vehicle.condition,
      plate_type: payload.vehicle.plateType,
      vin: payload.vehicle.vin,
    })
    .select('id')
    .single();
  if (vErr) throw mapDbError(vErr.message);

  // TODO(Phase 4): upload processed photos to the `listing-photos` bucket and
  // insert listing_photos rows — blocked on the signed-in session (storage
  // policies require auth.uid()); until then the listing is created without
  // cover photos rather than with broken storage paths.
  const { data: listing, error: lErr } = await c
    .from('listings')
    .insert({
      slug: `a-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      created_by: uid,
      vehicle_id: vehicle.id,
      price_irr: payload.priceIRR,
      city: payload.city,
      description: payload.description,
      state: 'pending_review',
      allow_phone_reveal: payload.allowPhoneReveal,
    })
    .select('id, slug, price_irr, state, published_at')
    .single();
  if (lErr) throw mapDbError(lErr.message);

  return {
    id: listing.id,
    slug: listing.slug,
    priceIRR: Number(listing.price_irr),
    state: listing.state,
    publishedAt: listing.published_at,
    draft: payload,
  };
}

export async function updateListing(
  id: string,
  payload: ListingPublish,
  localPhotos?: ProcessedPhoto[],
): Promise<void> {
  if (isDemoMode) {
    const found = store().find((l) => l.id === id);
    if (!found) throw new Error('آگهی یافت نشد.');
    found.draft = payload;
    found.priceIRR = payload.priceIRR;
    if (localPhotos !== undefined) found.localPhotos = localPhotos;
    return;
  }

  const c = client();
  await requireUserId(c);

  const { data: row, error: rErr } = await c
    .from('listings')
    .select('vehicle_id')
    .eq('id', id)
    .maybeSingle();
  if (rErr) throw mapDbError(rErr.message);
  if (!row) throw new Error('آگهی یافت نشد.');

  const vErr = (
    await c
      .from('vehicles')
      .update({
        brand: payload.vehicle.brand,
        model: payload.vehicle.model,
        trim: payload.vehicle.trim,
        year: payload.vehicle.year,
        mileage_km: payload.vehicle.mileageKm,
        gearbox: payload.vehicle.gearbox,
        fuel: payload.vehicle.fuel,
        color: payload.vehicle.color,
        condition: payload.vehicle.condition,
        plate_type: payload.vehicle.plateType,
        vin: payload.vehicle.vin,
      })
      .eq('id', row.vehicle_id)
  ).error;
  if (vErr) throw mapDbError(vErr.message);

  const lErr = (
    await c
      .from('listings')
      .update({
        price_irr: payload.priceIRR,
        city: payload.city,
        description: payload.description,
        allow_phone_reveal: payload.allowPhoneReveal,
      })
      .eq('id', id)
  ).error;
  if (lErr) throw mapDbError(lErr.message);

  // Photo rows: only meaningful once Phase 4 uploads them to storage (see the
  // matching TODO in createListing) — never insert metadata for missing files.
}

export async function setListingState(id: string, next: ListingState): Promise<void> {
  if (isDemoMode) {
    const found = store().find((l) => l.id === id);
    if (!found) throw new Error('آگهی یافت نشد.');
    found.state = next;
    if (next === 'active' && !found.publishedAt) found.publishedAt = new Date().toISOString();
    return;
  }

  const c = client();
  await requireUserId(c);
  const { error } = await c.from('listings').update({ state: next }).eq('id', id);
  if (error) throw mapDbError(error.message);
}

export async function deleteListing(id: string): Promise<void> {
  if (isDemoMode) {
    demo = store().filter((l) => l.id !== id);
    return;
  }
  const c = client();
  await requireUserId(c);
  const { error } = await c.from('listings').delete().eq('id', id);
  if (error) throw mapDbError(error.message);
}

/** Plan slots consumed by draft/pending/active/paused listings (shared rule). */
export function usedSlots(listings: MyListing[]): number {
  return listings.filter((l) => isSlotState(l.state)).length;
}
