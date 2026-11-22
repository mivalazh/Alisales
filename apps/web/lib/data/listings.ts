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
import { cataloguePrerenderIssue } from '../config/build-guard';
import { admin } from './s2-store';
import { visibleCatalog } from './demo-seed';
import { storeVersion } from '../storage/demo-store';
import { supabaseFetch } from './supabase-fetch';
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
  /** Seller-declared insurance, paint, chassis and inspection facts. */
  thirdPartyInsurance?: boolean | null;
  thirdPartyMonths?: number | null;
  bodyInsurance?: boolean | null;
  bodyMonths?: number | null;
  paintCondition?: string | null;
  chassisCondition?: string | null;
  technicalInspection?: boolean | null;
  isJournalPhoto?: boolean;
  inspectionSheetUrl?: string | null;
  inspectionNote?: string | null;
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
  /** Vehicle category (0014); null for parts. */
  category?: 'car' | 'motorcycle' | 'heavy' | null;
  /** Body class (0014); null when the seller never picked one. */
  body_type?: string | null;
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
  third_party_insurance?: boolean | null;
  third_party_months?: number | null;
  body_insurance?: boolean | null;
  body_months?: number | null;
  paint_condition?: string | null;
  chassis_condition?: string | null;
  technical_inspection?: boolean | null;
  is_journal_photo?: boolean | null;
  inspection_sheet_url?: string | null;
  inspection_note?: string | null;
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
    // Parts carry no category; a vehicle row's value comes from 0014 and
    // defaults to a car for rows written before it.
    category: r.kind === 'part' ? undefined : (r.category ?? 'car'),
    bodyType: (r.body_type as BodyType | null | undefined) ?? null,
    engineCc: r.engine_cc ?? null,
    bikeType: r.bike_type ?? null,
    heavyType: r.heavy_type ?? null,
    workingHours: r.working_hours ?? null,
    thirdPartyInsurance: r.third_party_insurance ?? null,
    thirdPartyMonths: r.third_party_months ?? null,
    bodyInsurance: r.body_insurance ?? null,
    bodyMonths: r.body_months ?? null,
    paintCondition: r.paint_condition ?? null,
    chassisCondition: r.chassis_condition ?? null,
    technicalInspection: r.technical_inspection ?? null,
    isJournalPhoto: r.is_journal_photo ?? false,
    inspectionSheetUrl: r.inspection_sheet_url ?? null,
    inspectionNote: r.inspection_note ?? null,
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
  // Reads are capped at 2.5s; see lib/data/supabase-fetch.ts. PostgREST retries
  // are off because the budget lives in the fetch wrapper: each retry would get
  // a fresh 2.5s and the total (2.5s + backoff + retries) would stretch to ~15s.
  return createClient(url, anon, {
    auth: { persistSession: false },
    db: { retry: false },
    global: { fetch: supabaseFetch },
  });
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
      listing.color,
      listing.part?.title,
      listing.part?.compatibility,
      listing.paintCondition,
      listing.chassisCondition,
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
/**
 * Catalogue base rows, memoised for a few seconds.
 *
 * Every browse render merges the seeded fixtures with the demo store (owner
 * listings, edits, media). The merge itself is cheap but it re-reads a handful
 * of files per request, which is pure repeat work when a buyer steps between
 * the category tabs. The cache key carries the store's write counter, so any
 * publish, edit or moderation change invalidates it immediately; the TTL only
 * bounds memory and picks up writes made by another process.
 *
 * Per-user rows (the signed «my listings» cookie) are merged *after* this, so
 * no buyer's data can ever be served to another.
 */
let catalogBaseCache: { version: number; at: number; rows: ListingCardData[] } | null = null;
/** One browse revalidate window: a published card may take up to 30s to lead. */
const CATALOG_CACHE_MS = 30_000;

function catalogBase(): ListingCardData[] {
  const version = storeVersion();
  if (
    catalogBaseCache &&
    catalogBaseCache.version === version &&
    Date.now() - catalogBaseCache.at < CATALOG_CACHE_MS
  ) {
    return catalogBaseCache.rows;
  }
  const rows = visibleCatalog(fixtureListings, devListings());
  catalogBaseCache = { version, at: Date.now(), rows };
  return rows;
}

async function fixtureSearchListings(
  filters: SearchFilters,
  category?: VehicleCategory,
  /** Read the signed «my listings» cookie (impossible in a static render). */
  includeMine = true,
): Promise<ListingCardData[]> {
  const overlay = moderationOverlay();
  // The seller's own just-published cards ride in a signed cookie so they are
  // visible even when the demo store lives in another Workers isolate.
  const mine = includeMine ? await readMyListings() : [];
  const local = applyModeration(
    applyListingOverrides(mergeMyListings(mine, catalogBase())),
    {
      hidden: overlay.hidden,
      verifiedSellers: overlay.verifiedSellers,
    },
  );
  return applyFiltersLocally(local, filters, category);
}

/**
 * Hosted browse rows, memoised per filter payload for 30 seconds.
 *
 * Every catalogue tab, chip change and back-navigation used to run the whole
 * `search_listings` RPC again. The RPC is public (RLS, no per-user rows), so
 * one answer is valid for every visitor inside a 30-second window; the key is
 * the serialized filter payload plus the category, and the map is bounded so a
 * scripted crawler cannot grow it without limit.
 */
const HOSTED_CACHE_TTL_MS = 30_000;
const HOSTED_CACHE_MAX = 64;
const hostedCache = new Map<string, { at: number; rows: ListingCardData[] }>();

function hostedCacheGet(key: string): ListingCardData[] | null {
  const hit = hostedCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at >= HOSTED_CACHE_TTL_MS) {
    hostedCache.delete(key);
    return null;
  }
  return hit.rows;
}

function hostedCacheSet(key: string, rows: ListingCardData[]): void {
  if (hostedCache.size >= HOSTED_CACHE_MAX) {
    const oldest = hostedCache.keys().next().value;
    if (oldest !== undefined) hostedCache.delete(oldest);
  }
  hostedCache.set(key, { at: Date.now(), rows });
}

/** Test hook: drop memoised hosted rows (after a seeded write, for example). */
export function resetHostedCatalogCache(): void {
  hostedCache.clear();
}

/** One page of a catalogue read. The RPC clamps `limit` to 100 rows. */
export interface CataloguePage {
  limit: number;
  offset: number;
}

/** What a page render carries; the browser shells page wider after hydration. */
const FIRST_PAGE: CataloguePage = { limit: 48, offset: 0 };

function pageSlice(rows: ListingCardData[], page: CataloguePage): ListingCardData[] {
  return rows.slice(page.offset, page.offset + page.limit);
}

/**
 * Fail a production prerender that would cache an empty catalogue page.
 *
 * Runtime pages must still serve a legitimately empty marketplace, so this only
 * speaks during `next build`. A category page may be empty while the catalogue
 * is not; the caller only reaches this when the hosted catalogue itself has no
 * rows (or the read failed), which is the configured-but-broken case.
 */
function assertPrerenderedCatalogue(
  source: string,
  rows: readonly ListingCardData[],
  failure?: string,
): void {
  const issue = cataloguePrerenderIssue({
    phase: process.env.NEXT_PHASE,
    allowEmpty: process.env.ALLOW_EMPTY_CATALOGUE,
    source,
    rows: rows.length,
    failure,
  });
  if (issue) throw new Error(issue);
}

/**
 * The one search implementation.
 *
 * `includeMine` is what separates the request-scoped search from the public
 * one: the signed my-listings cookie is per visitor, so a route that must be
 * statically generated (and CDN-cached) cannot read it. Everything else — the
 * hosted RPC, the memo, the seeded fallback — is shared.
 */
async function search(
  filters: SearchFilters,
  category: VehicleCategory | undefined,
  includeMine: boolean,
  page?: CataloguePage,
): Promise<ListingCardData[]> {
  const effective = launchFilters(filters);
  const source = category ? `${category} catalogue` : 'public catalogue';
  // A caller that does not page keeps its old shape: the hosted read answers
  // its first page, and the seeded catalogue answers everything it has.
  const read = page ?? FIRST_PAGE;
  const slice = (rows: ListingCardData[]) => (page ? pageSlice(rows, page) : rows);
  const supabase = supabaseClient();
  if (!supabase) return slice(await fixtureSearchListings(filters, category, includeMine));

  // The page's category rides in the payload so the RPC narrows in SQL (a
  // hosted /motorcycles never pages cars across the wire to discard them).
  const payload = {
    ...filtersToRpcPayload(effective),
    ...(category ? { category } : {}),
  };
  const cacheKey = JSON.stringify({ f: payload, l: read.limit, o: read.offset });
  const memo = hostedCacheGet(cacheKey);
  if (memo) return memo;

  let failure: string | undefined;
  try {
    const { data, error } = await supabase.rpc('search_listings', {
      p_filters: payload,
      p_limit: read.limit,
      p_offset: read.offset,
    });
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as unknown as ListingCardRow[])
      .map(mapRow)
      .filter((l) => inBrowseCategory(l, category));
    if (read.offset > 0 || rows.length > 0) {
      // The RPC already scopes the category; this stays as a cheap backstop and
      // keeps the three category pages on one code path online and offline.
      const ranked = rankSearch(rows, filters.q);
      hostedCacheSet(cacheKey, ranked);
      return ranked;
    }
    // The first page is empty. A second unfiltered, one-row probe separates an
    // empty category (real, and it must stay empty) from an empty catalogue
    // (the seed-hidden failure mode, which may use the seed).
    const probe = await supabase.rpc('search_listings', {
      p_filters: filtersToRpcPayload(launchFilters(DEFAULT_FILTERS)),
      p_limit: 1,
      p_offset: 0,
    });
    if (probe.error) throw new Error(probe.error.message);
    if (Array.isArray(probe.data) && probe.data.length > 0) return [];
  } catch (error) {
    // A later page failing means the rest of the pool is unreachable too, so
    // answer with the error instead of a silently truncated grid.
    if (read.offset > 0) throw error;
    // Missing table/column, PostgREST or RLS failure: keep the public catalogue
    // alive with the seeded/signed-cookie rows instead of throwing to error.tsx.
    console.warn('[alisales] catalog read fell back to local rows:', error);
    failure = error instanceof Error ? error.message : String(error);
  }

  // One exit for "the hosted catalogue produced nothing usable": the seed is
  // the last first paint, and a build must not cache the zero-row version.
  const fallback = slice(await fixtureSearchListings(filters, category, includeMine));
  assertPrerenderedCatalogue(source, fallback, failure);
  return fallback;
}

export async function searchListings(
  filters: SearchFilters = DEFAULT_FILTERS,
  category?: VehicleCategory,
  page?: CataloguePage,
): Promise<ListingCardData[]> {
  return search(filters, category, true, page);
}

/**
 * Catalogue read for statically generated pages: identical rows, but it never
 * touches the request (no signed my-listings cookie), so the result is safe to
 * cache at the edge for every visitor.
 */
export async function searchPublicListings(
  filters: SearchFilters = DEFAULT_FILTERS,
  category?: VehicleCategory,
  page?: CataloguePage,
): Promise<ListingCardData[]> {
  return search(filters, category, false, page);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A listing URL may arrive raw, percent-encoded once or twice (Persian slugs
 * and shared links both occur). Resolve every sensible representation so a
 * valid listing never 404s because of URL encoding alone.
 */
function slugCandidates(raw: string): string[] {
  const candidates: string[] = [];
  let current = raw.trim();
  for (let pass = 0; pass < 3 && current; pass += 1) {
    if (!candidates.includes(current)) candidates.push(current);
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return candidates;
}

/**
 * Listing detail by slug — null when missing or not public (the view's RLS
 * enforces visibility, so sold shows and drafts/hidden 404 honestly).
 */
async function fixtureListing(slug: string): Promise<ListingDetailData | null> {
  const candidates = slugCandidates(slug);
  const mine = await readMyListings();
  const all = mergeMyListings(mine, catalogBase());
  const found = applyListingOverrides(all).find(
    (l) => candidates.includes(l.slug) || candidates.includes(l.id),
  );
  // Owner-removed listings are gone from the public site, not just the grid.
  if (!found || found.state === 'rejected') return null;
  // Fixture sellers do write descriptions; the detail page shows them like
  // any other listing (empty only when the seller truly left it blank).
  return { ...found, description: found.description ?? null, photos: found.photos ?? [] };
}

export async function getListing(slug: string): Promise<ListingDetailData | null> {
  const candidates = slugCandidates(slug);
  const supabase = supabaseClient();
  if (!supabase) return fixtureListing(slug);

  try {
    let data: unknown = null;
    for (const candidate of candidates) {
      const bySlug = await supabase
        .from('listing_cards')
        .select('*')
        .eq('slug', candidate)
        .maybeSingle();
      if (bySlug.error) throw new Error(bySlug.error.message);
      if (bySlug.data) {
        data = bySlug.data;
        break;
      }
      // Shared/detail links may carry the listing UUID instead of its slug.
      if (UUID_RE.test(candidate)) {
        const byId = await supabase
          .from('listing_cards')
          .select('*')
          .eq('id', candidate)
          .maybeSingle();
        if (byId.error) throw new Error(byId.error.message);
        if (byId.data) {
          data = byId.data;
          break;
        }
      }
    }
    if (!data) return fixtureListing(slug);

    // Gallery rows live in listing_photos (RLS: readable whenever the listing is);
    // ordered by position so position 0 stays the cover. A gallery failure
    // keeps the already-resolved hosted listing and falls back to its cover.
    let photos: string[] = [];
    try {
      const { data: photoRows, error: photoError } = await supabase
        .from('listing_photos')
        .select('storage_path')
        .eq('listing_id', (data as { id: string }).id)
        .order('position', { ascending: true });
      if (photoError) throw new Error(photoError.message);
      photos = ((photoRows ?? []) as Array<{ storage_path: string }>)
        .map((row) => publicPhotoUrl(row.storage_path))
        .filter((url): url is string => Boolean(url));
    } catch (photoError) {
      console.warn('[alisales] listing gallery read failed; using cover:', photoError);
    }

    return { ...mapRow(data as ListingCardRow), photos };
  } catch (error) {
    console.warn('[alisales] listing detail fell back to local rows:', error);
    return fixtureListing(slug);
  }
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
    const found = applyListingOverrides(visibleCatalog(fixtureListings, devListings())).find((l) => l.id === id);
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
    const found = visibleCatalog(fixtureListings, devListings()).find((l) => l.id === id);
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
