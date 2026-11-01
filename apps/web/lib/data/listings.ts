import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_CITY,
  DEFAULT_FILTERS,
  featureFlags,
  filtersToRpcPayload,
  type ColorSlug,
  type Condition,
  type Fuel,
  type Gearbox,
  type ListingState,
  type PartCategory,
  type PartCondition,
  type PartOrigin,
  type PlateType,
  type SearchFilters,
} from '@alisales/schemas';
import { fixtureListings } from './fixtures';
import { devListings } from './dev-store';
import { admin } from './s2-store';

/** Structured part data for a non-vehicle listing (`parts_listings`). */
export interface PartInfo {
  title: string;
  category: PartCategory;
  origin: PartOrigin;
  condition: PartCondition;
  partNumber: string | null;
  compatibility: string | null;
  warranty: string | null;
}

/** Row shape returned by the public.listing_cards view / search_listings RPC. */
export interface ListingCardData {
  id: string;
  slug: string;
  sellerId: string;
  priceIRR: number;
  city: string;
  state: ListingState;
  featured: boolean;
  /** ISO timestamp — rendered as a Jalali date. */
  publishedAt: string | null;
  hasReport: boolean;
  brand: string;
  model: string;
  trim: string | null;
  year: number;
  mileageKm: number;
  gearbox: Gearbox;
  fuel: Fuel;
  color: ColorSlug;
  condition: Condition;
  plateType: PlateType;
  /** Public storage URL, or null (no photo / credential-less fixture mode). */
  coverUrl: string | null;
  /** Ordered gallery URLs (cover first); fixture-mode cards carry them locally. */
  photos?: string[];
  showroomName: string | null;
  showroomVerified: boolean;
  /** Seller opted into showing the phone (server still gates sold → never). */
  allowPhoneReveal: boolean;
  /** «vehicle» for cars; «part» for parts & accessories listings. */
  kind?: 'vehicle' | 'part';
  /** Present only for parts listings. */
  part?: PartInfo | null;
  /** Seller text — carried by fixture cards so the editor can prefill it. */
  description?: string | null;
}

/** Detail projection: the card plus the long description and gallery. */
export interface ListingDetailData extends ListingCardData {
  description: string | null;
  /** Ordered photo URLs from `listing_photos` (position 0 = cover). */
  photos: string[];
}

interface ListingCardRow {
  id: string;
  slug: string;
  seller_id: string;
  price_irr: number | string;
  city: string;
  state: ListingState;
  featured: boolean;
  published_at: string | null;
  has_report: boolean;
  brand: string;
  model: string;
  trim: string | null;
  year: number;
  mileage_km: number;
  gearbox: Gearbox;
  fuel: Fuel;
  color: ColorSlug;
  condition: Condition;
  plate_type: PlateType;
  cover_photo_path: string | null;
  showroom_name: string | null;
  showroom_verified: boolean;
  allow_phone_reveal: boolean;
  description?: string | null;
  /** 0007: `vehicle` | `part`. */
  kind?: 'vehicle' | 'part' | null;
  part_title?: string | null;
  part_category?: PartCategory | null;
  part_origin?: PartOrigin | null;
  part_condition?: PartCondition | null;
  part_number?: string | null;
  part_compatibility?: string | null;
  part_warranty?: string | null;
}

const STORAGE_BUCKET = 'listing-photos';

function publicPhotoUrl(path: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/${STORAGE_BUCKET}/${path}` : null;
}

function mapRow(r: ListingCardRow): ListingDetailData {
  return {
    id: r.id,
    slug: r.slug,
    sellerId: r.seller_id,
    priceIRR: Number(r.price_irr), // pg bigint arrives as string
    city: r.city,
    state: r.state,
    featured: r.featured,
    publishedAt: r.published_at,
    hasReport: r.has_report,
    brand: r.brand,
    model: r.model,
    trim: r.trim,
    year: r.year,
    mileageKm: r.mileage_km,
    gearbox: r.gearbox,
    fuel: r.fuel,
    color: r.color,
    condition: r.condition,
    plateType: r.plate_type,
    coverUrl: r.cover_photo_path ? publicPhotoUrl(r.cover_photo_path) : null,
    showroomName: r.showroom_name,
    showroomVerified: r.showroom_verified,
    allowPhoneReveal: r.allow_phone_reveal,
    description: r.description ?? null,
    photos: [],
    kind: r.kind === 'part' ? 'part' : 'vehicle',
    part: r.part_title
      ? {
          title: r.part_title,
          category: r.part_category ?? 'other',
          origin: r.part_origin ?? 'unknown',
          condition: r.part_condition ?? 'used',
          partNumber: r.part_number ?? null,
          compatibility: r.part_compatibility ?? null,
          warranty: r.part_warranty ?? null,
        }
      : null,
  };
}

function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon);
}

/**
 * Launch rule: while `city_selection` is off, browse/search is Kish-only —
 * one data path enforces it for the RPC, fixtures and the dev store alike.
 */
function launchFilters(filters: SearchFilters): SearchFilters {
  if (featureFlags.city_selection) return filters;
  return { ...filters, city: [DEFAULT_CITY] };
}

function matches(listing: ListingCardData, f: SearchFilters): boolean {
  if (f.city.length && !f.city.includes(listing.city)) return false;
  if (f.kishOnly && listing.city !== 'kish') return false;
  if (f.brand.length && !f.brand.some((b) => b === listing.brand)) return false;
  if (f.model && !listing.model.includes(f.model)) return false;
  if (f.yearFrom !== undefined && listing.year < f.yearFrom) return false;
  if (f.yearTo !== undefined && listing.year > f.yearTo) return false;
  if (f.priceFrom !== undefined && listing.priceIRR < f.priceFrom) return false;
  if (f.priceTo !== undefined && listing.priceIRR > f.priceTo) return false;
  if (f.mileageMax !== undefined && listing.mileageKm > f.mileageMax) return false;
  if (f.gearbox.length && !f.gearbox.includes(listing.gearbox)) return false;
  if (f.plateType.length && !f.plateType.includes(listing.plateType)) return false;
  if (f.condition.length && !f.condition.includes(listing.condition)) return false;
  if (f.hasReport && !listing.hasReport) return false;
  if (f.q && !`${listing.model} ${listing.trim ?? ''} ${listing.brand}`.includes(f.q)) {
    return false;
  }
  return true;
}

/**
 * Credential-less mode: same filter semantics as the RPC, applied locally so
 * the offline catalog behaves exactly like the hosted one (chips included).
 */
export function applyFiltersLocally(
  list: readonly ListingCardData[],
  filters: SearchFilters,
): ListingCardData[] {
  const effective = launchFilters(filters);
  return list.filter((l) => matches(l, effective)).sort(soldLastThenRecency);
}

/** Same ranking shape as the RPC: sold last, then most recent first. */
function soldLastThenRecency(a: ListingCardData, b: ListingCardData): number {
  const aSold = a.state === 'sold' ? 1 : 0;
  const bSold = b.state === 'sold' ? 1 : 0;
  if (aSold !== bSold) return aSold - bSold;
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  const at = a.publishedAt ? Date.parse(a.publishedAt) : 0;
  const bt = b.publishedAt ? Date.parse(b.publishedAt) : 0;
  return bt - at;
}

/**
 * Search listings — the single data path for the web grid.
 *
 * With Supabase credentials the shared `search_listings` RPC runs (same filter
 * implementation the mobile app uses, RLS-checked). Without them the seeded
 * local fixtures are served so the UI is fully reviewable offline.
 */
export async function searchListings(
  filters: SearchFilters = DEFAULT_FILTERS,
): Promise<ListingCardData[]> {
  const effective = launchFilters(filters);
  const supabase = supabaseClient();
  if (!supabase) {
    return applyFiltersLocally([...devListings(), ...fixtureListings], filters);
  }

  const { data, error } = await supabase.rpc('search_listings', {
    p_filters: filtersToRpcPayload(effective),
    p_limit: 48,
    p_offset: 0,
  });
  if (error) throw new Error(`search_listings RPC failed: ${error.message}`);
  return (data as unknown as ListingCardRow[]).map(mapRow);
}

/**
 * Listing detail by slug — null when missing or not public (the view's RLS
 * enforces visibility, so sold shows and drafts/hidden 404 honestly).
 */
export async function getListing(slug: string): Promise<ListingDetailData | null> {
  const supabase = supabaseClient();
  if (!supabase) {
    const all = [...devListings(), ...fixtureListings];
    const found = all.find((l) => l.slug === slug);
    return found ? { ...found, description: null, photos: found.photos ?? [] } : null;
  }

  const { data, error } = await supabase
    .from('listing_cards')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`listing_cards query failed: ${error.message}`);
  if (!data) return null;

  // Gallery rows live in listing_photos (RLS: readable whenever the listing is);
  // ordered by position so position 0 stays the cover.
  const { data: photoRows } = await supabase
    .from('listing_photos')
    .select('storage_path')
    .eq('listing_id', (data as { id: string }).id)
    .order('position', { ascending: true });
  const photos = ((photoRows ?? []) as Array<{ storage_path: string }>)
    .map((row) => publicPhotoUrl(row.storage_path))
    .filter((url): url is string => Boolean(url));

  return { ...mapRow(data as unknown as ListingCardRow), photos };
}

/** Owner-visible photo metadata (edit form prefill: paths, order, sizes). */
export interface OwnerPhotoMeta {
  path: string;
  url: string;
  mime: 'image/webp';
  bytes: number;
  width: number;
  height: number;
}

/**
 * A listing the owner is about to edit — includes paused/sold rows the public
 * view hides, so the owner panel resolves it with the service client.
 */
export async function getOwnerListing(id: string): Promise<ListingDetailData | null> {
  const sb = admin();
  if (!sb) {
    const found = [...devListings(), ...fixtureListings].find((l) => l.id === id);
    if (!found) return null;
    return {
      ...found,
      description: found.description ?? null,
      photos: found.photos ?? [],
    };
  }
  const { data, error } = await sb.from('listing_cards').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`owner listing query failed: ${error.message}`);
  if (!data) return null;
  const photos = await availablePhotoMetas(sb, id);
  return { ...mapRow(data as unknown as ListingCardRow), photos: photos.map((p) => p.url) };
}

/** Ordered photo metadata for the edit gallery (position 0 = cover). */
export async function getOwnerPhotos(id: string): Promise<OwnerPhotoMeta[]> {
  const sb = admin();
  if (!sb) {
    const found = [...devListings(), ...fixtureListings].find((l) => l.id === id);
    return (found?.photos ?? []).map((url, index) => ({
      path: url.replace(/^\/api\/photos\//, ''),
      url,
      mime: 'image/webp' as const,
      // Fixture cards only carry URLs; the schema needs positive sizes.
      bytes: 1,
      width: 1200,
      height: 900,
      position: index,
    })).map(({ position: _position, ...photo }) => photo);
  }
  return availablePhotoMetas(sb, id);
}

async function availablePhotoMetas(
  sb: NonNullable<ReturnType<typeof admin>>,
  listingId: string,
): Promise<OwnerPhotoMeta[]> {
  const { data } = await sb
    .from('listing_photos')
    .select('storage_path, mime, bytes, width, height')
    .eq('listing_id', listingId)
    .order('position', { ascending: true });
  return ((data ?? []) as Array<{
    storage_path: string;
    mime: string;
    bytes: number;
    width: number;
    height: number;
  }>)
    .map((row) => {
      const url = publicPhotoUrl(row.storage_path);
      return url
        ? {
            path: row.storage_path,
            url,
            mime: 'image/webp' as const,
            bytes: row.bytes,
            width: row.width,
            height: row.height,
          }
        : null;
    })
    .filter((photo): photo is OwnerPhotoMeta => Boolean(photo));
}

/**
 * Seller phone — the RPC returns null for sold listings and for listings
 * without allow_phone_reveal; the UI hides the call button when null.
 */
export async function getSellerPhone(listingId: string): Promise<string | null> {
  const supabase = supabaseClient();
  if (!supabase) return null; // credential-less fixture mode has no phone data
  const { data, error } = await supabase.rpc('get_seller_phone', {
    p_listing: listingId,
  });
  if (error) throw new Error(`get_seller_phone RPC failed: ${error.message}`);
  return (data as string | null) ?? null;
}

/**
 * Fixture-mode demo number. Credential-less mode never had seller phones and
 * no real number may be invented for a seeded account, so the reveal flow uses
 * a clearly fake number there — hosted mode always reads `get_seller_phone`.
 */
export const FIXTURE_SELLER_PHONE = '09120000000';
