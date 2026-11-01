import type { ListingPublish, PartListingPublish } from '@alisales/schemas';
import { admin } from './s2-store';
import type { ListingCardData } from './listings';
import { addDevListing } from './dev-store';

/**
 * Listing publish pipeline (S2 + hosted persistence).
 *
 * - Hosted mode (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY): inserts the real
 *   rows — `vehicles` + `listings` for cars, `listings(kind='part')` +
 *   `part_details` for parts. `state` is written as `active` and published_at
 *   set immediately (C6); the column default stays `draft`.
 * - Fixture mode: the route hands over a prepared card for the local dev store.
 *
 * Photos: the browser submits local `pending/…` paths (the bytes never leave the
 * device in this stage), so they are not written as storage rows — a hosted
 * listing publishes with a placeholder cover rather than a broken URL. Paths
 * that already point at real storage are recorded.
 */

export interface HostedPublishInput {
  kind: 'vehicle' | 'part';
  data: ListingPublish | PartListingPublish;
  sellerId: string;
}

function slugFor(kind: 'vehicle' | 'part'): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${kind === 'part' ? 'part' : 'car'}-${stamp}${rand}`;
}

const PENDING_PHOTO_PREFIX = 'pending/';

/**
 * Publish one listing into Supabase. Returns the public slug.
 * Throws on any database error — the route turns that into a 500 and never
 * reports a listing that was not written.
 */
export async function publishHosted(input: HostedPublishInput): Promise<string> {
  const sb = admin();
  if (!sb) throw new Error('publishHosted called without Supabase credentials');

  const { data } = input;
  let vehicleId: string | null = null;

  if (input.kind === 'vehicle') {
    const vehicle = (data as ListingPublish).vehicle;
    const insertedVehicle = await sb
      .from('vehicles')
      .insert({
        created_by: input.sellerId,
        brand: vehicle.brand,
        model: vehicle.model,
        trim: vehicle.trim,
        year: vehicle.year,
        mileage_km: vehicle.mileageKm,
        gearbox: vehicle.gearbox,
        fuel: vehicle.fuel,
        color: vehicle.color,
        condition: vehicle.condition,
        plate_type: vehicle.plateType,
      })
      .select('id')
      .single();
    if (insertedVehicle.error || !insertedVehicle.data) {
      throw new Error(`insert vehicle failed: ${insertedVehicle.error?.message ?? 'unknown'}`);
    }
    vehicleId = String(insertedVehicle.data.id);
  }

  const slug = slugFor(input.kind);
  const publishedAt = new Date();
  const listing = await sb
    .from('listings')
    .insert({
      slug,
      created_by: input.sellerId,
      showroom_id: data.showroomId ?? null,
      vehicle_id: vehicleId,
      kind: input.kind,
      price_irr: data.priceIRR,
      city: data.city,
      description: data.description,
      state: 'active',
      allow_phone_reveal: data.allowPhoneReveal,
      published_at: publishedAt.toISOString(),
      expires_at: new Date(publishedAt.getTime() + 90 * 24 * 3600 * 1000).toISOString(),
    })
    .select('id')
    .single();
  if (listing.error || !listing.data) {
    throw new Error(`insert listing failed: ${listing.error?.message ?? 'unknown'}`);
  }
  const listingId = String(listing.data.id);

  if (input.kind === 'part') {
    const part = data as PartListingPublish;
    const details = await sb.from('part_details').insert({
      listing_id: listingId,
      category: part.category,
      title: part.title,
      origin: part.origin,
      condition: part.condition,
      part_number: part.partNumber,
      compatibility: part.compatibility,
      warranty: part.warranty,
    });
    if (details.error) {
      // Never leave a half-written part behind: the listing row is useless
      // without its details, so roll it back and surface the failure.
      await sb.from('listings').delete().eq('id', listingId);
      throw new Error(`insert part details failed: ${details.error.message}`);
    }
  }

  const uploaded = data.photos.filter((p) => !p.path.startsWith(PENDING_PHOTO_PREFIX));
  if (uploaded.length > 0) {
    const photos = await sb.from('listing_photos').insert(
      uploaded.map((p, i) => ({
        listing_id: listingId,
        storage_path: p.path,
        position: p.position ?? i,
        mime: p.mime,
        bytes: p.bytes,
        width: p.width,
        height: p.height,
      })),
    );
    if (photos.error) {
      throw new Error(`insert listing photos failed: ${photos.error.message}`);
    }
  }

  return slug;
}

/** Fixture-mode publish: same response shape, local JSON store. */
export function publishFixture(card: ListingCardData): string {
  addDevListing(card);
  return card.slug;
}
