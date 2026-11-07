import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_CITY,
  DEFAULT_FILTERS,
  featureFlags,
  filtersToRpcPayload,
  searchRelevance,
  type BodyType,
  type Condition,
  type Fuel,
  type Gearbox,
  type ListingState,
  type PartCategory,
  type PartCondition,
  type PartOrigin,
  type PlateType,
  type SearchFilters,
  type VehicleCategory,
} from '@alisales/schemas';
import { fixtureListings } from './fixtures';
import { applyListingOverrides, devListings } from './dev-store';
import { moderationOverlay } from './moderation-store';
import { applyModeration } from './moderation-rules';
import { matchesFilters } from '../filter-match';
import { admin } from './s2-store';
import { mergeMyListings, readMyListings } from './my-listings-cookie';

/** Structured part data for a non-vehicle listing (`parts_listings`). */
export interface PartInfo {
  title: string;
  category: PartCategory;
  origin: PartOrigin;
  /** Country of manufacture typed by the seller («ژاپن»، «آلمان»). */
  originCountry?: string | null;
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
  /**
   * Public view count for the «پربازدیدترین» sort. Fixture cards seed it and
   * the owner-stat paths compute it; hosted cards rank as zero until the
   * browse RPC returns a count.
   */
  views?: number;
  hasReport: boolean;
  brand: string;
  model: string;
  trim: string | null;
  year: number;
  mileageKm: number;
  gearbox: Gearbox;
  fuel: Fuel;
  /** Free-text colour for new rows; legacy rows carry a colour slug. */
  color: string;
  /** Standard body class (تیپ / کلاس بدنه) when the seller picked one. */
  bodyType?: BodyType | null;
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
  /** Seller asked to show the Toman price only (no «≈ … AED» line). */
  hideAed?: boolean;
  /** «vehicle» for cars; «part» for parts & accessories listings. */
  kind?: 'vehicle' | 'part';
  /** Vehicle category: car (default), motorcycle or heavy machinery. */
  category?: 'car' | 'motorcycle' | 'heavy';
  /** Motorcycle displacement in cc. */
  engineCc?: number | null;
  /** Motorcycle class («classic» / «sport» / «scooter» / «cross» …). */
  bikeType?: string | null;
  /** Heavy machinery class («truck» / «tractor» / «excavator» …). */
  heavyType?: string | null;
  /** Heavy machinery working hours. */
  workingHours?: number | null;
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
  color: string;
  condition: Condition;
  plate_type: PlateType;
  cover_photo_path: string | null;
  showroom_name: string | null;
  showroom_verified: boolean;
  allow_phone_reveal: boolean;
  description?: string | null;
  /** 0007: `vehicle` | `part`. */
  kind?: 'vehicle' | 'part' | null;
  /** Present when the hosted view exposes the vehicle category. */
  category?: 'car' | 'motorcycle' | 'heavy' | null;
  engine_cc?: number | null;
  bike_type?: string | null;
  heavy_type?: string | null;
  working_hours?: number | null;
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
    // Hosted rows without the category column read as cars, which is the
    // launch default; the fixture catalogue carries the richer value.
    category: r.kind === 'part' ? undefined : (r.category ?? 'car'),
    engineCc: r.engine_cc ?? null,
    bikeType: r.bike_type ?? null,
    heavyType: r.heavy_type ?? null,
    workingHours: r.working_hours ?? null,
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

/**
 * Browse is the car + parts catalogue unless a category is asked for.
 *
 * Motorcycles and heavy machinery have their own top-level pages; without this
 * narrowing they would also leak into the home grid and into every car filter
 * count. A dedicated vehicle page shows vehicles only — a brake disc has no
 * business in the car or motorcycle grid (parts live on `/parts` and the home
 * mixed feed).
 */
function inBrowseCategory(
  listing: ListingCardData,
  category: VehicleCategory | undefined,
): boolean {
  if (listing.kind === 'part') return category === undefined;
  return (listing.category ?? 'car') === (category ?? 'car');
}

/**
 * Credential-less mode: same filter semantics as the RPC, applied locally so
 * the offline catalog behaves exactly like the hosted one (chips included).
 */
export function applyFiltersLocally(
  list: readonly ListingCardData[],
  filters: SearchFilters,
  category?: VehicleCategory,
): ListingCardData[] {
  const effective = launchFilters(filters);
  const matched = list.filter(
    (l) => matchesFilters(l, effective) && inBrowseCategory(l, category),
  );
  // With a query the relevance band leads (sold still last inside a band);
  // without one the normal sold-last/featured/recency order is the ranking.
  return filters.q?.trim() ? rankSearch(matched, filters.q) : matched.sort(soldLastThenRecency);
}

/**
 * Relevance ranking for a typed query.
 *
 * Exact / prefix hits on brand, model and title score 100, synonym hits 70 and
 * typo-tolerant hits 40 (see SEARCH_SCORE). Sorting by that score first means
 * «لندکروزر» can never be out-ranked by a newer listing that merely contains a
 * fuzzy variant, while a query-less browse keeps the normal ranking untouched.
 * `sortListings` is stable, so within one band the sold-last/recency order of
 * `soldLastThenRecency` still decides.
 */
export function rankSearch(
  list: ListingCardData[],
  query: string | undefined,
): ListingCardData[] {
  if (!query?.trim()) return list;
  const scored = list.map((listing, index) => ({
    listing,
    index,
    score: searchRelevance(query, [
      listing.brand,
      listing.model,
      listing.trim,
      listing.part?.title,
      listing.part?.compatibility,
    ]),
  }));
  scored.sort(
    (a, b) => b.score - a.score || soldLastThenRecency(a.listing, b.listing) || a.index - b.index,
  );
  return scored.map((entry) => entry.listing);
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
  category?: VehicleCategory,
): Promise<ListingCardData[]> {
  const effective = launchFilters(filters);
  const supabase = supabaseClient();
  if (!supabase) {
    const overlay = moderationOverlay();
    // The seller's own just-published cards ride in a signed cookie so they are
    // visible even when the demo store lives in another Workers isolate.
    const mine = await readMyListings();
    const local = applyModeration(
      applyListingOverrides(mergeMyListings(mine, [...devListings(), ...fixtureListings])),
      {
        hidden: overlay.hidden,
        verifiedSellers: overlay.verifiedSellers,
      },
    );
    return applyFiltersLocally(local, filters, category);
  }

  const { data, error } = await supabase.rpc('search_listings', {
    p_filters: filtersToRpcPayload(effective),
    p_limit: 48,
    p_offset: 0,
  });
  if (error) throw new Error(`search_listings RPC failed: ${error.message}`);
  // The hosted view has no category column yet, so every vehicle row reads as a
  // car; keeping the narrowing here means the three category pages share one
  // code path online and offline.
  return rankSearch(
    (data as unknown as ListingCardRow[]).map(mapRow).filter((l) => inBrowseCategory(l, category)),
    filters.q,
  );
}

/**
 * Listing detail by slug — null when missing or not public (the view's RLS
 * enforces visibility, so sold shows and drafts/hidden 404 honestly).
 */
export async function getListing(slug: string): Promise<ListingDetailData | null> {
  const supabase = supabaseClient();
  if (!supabase) {
    const mine = await readMyListings();
    const all = mergeMyListings(mine, [...devListings(), ...fixtureListings]);
    const found = applyListingOverrides(all).find((l) => l.slug === slug);
    // Owner-removed listings are gone from the public site, not just the grid.
    if (!found || found.state === 'rejected') return null;
    // Fixture sellers do write descriptions; the detail page shows them like
    // any other listing (empty only when the seller truly left it blank).
    return { ...found, description: found.description ?? null, photos: found.photos ?? [] };
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
    const found = applyListingOverrides([...devListings(), ...fixtureListings]).find((l) => l.id === id);
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
