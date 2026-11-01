import type { ListingPhoto, ListingPublish, PartListingPublish } from '@alisales/schemas';
import { admin } from './s2-store';
import type { ListingCardData } from './listings';
import { addDevListing } from './dev-store';
import { devPhotoUrl, isOwnedPhotoPath, orderedPhotoRows } from './photo-rules';

/**
 * Listing publish/edit pipeline (S2 + hosted persistence).
 *
 * - Hosted mode (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY): inserts the real
 *   rows — `vehicles` + `listings` for cars, `listings(kind='part')` +
 *   `part_details` for parts. `state` is written as `active` and published_at
 *   set immediately (C6); the column default stays `draft`.
 * - Fixture mode: the route hands over a prepared card for the local dev store.
 *
 * Photos: the browser uploads the compressed WebP bytes to `/api/photos` first
 * and submits `{sellerId}/{uuid}.webp` paths. This module stores those paths as
 * ordered `listing_photos` rows (position 0 = cover), so cards and the detail
 * gallery render the real images. Every path must sit inside the seller's own
 * folder — anything else is refused instead of written.
 */

export interface HostedPublishInput {
  kind: 'vehicle' | 'part';
  data: ListingPublish | PartListingPublish;
  sellerId: string;
}

export interface ListingPatch {
  priceIRR?: number;
  description?: string;
  city?: string;
  allowPhoneReveal?: boolean;
  photos?: ListingPhoto[];
}

export type UpdateResult =
  | { ok: true }
  | { ok: false; status: 403 | 404 | 500; message: string };

function slugFor(kind: 'vehicle' | 'part'): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${kind === 'part' ? 'part' : 'car'}-${stamp}${rand}`;
}

/** Rejects a photo set that references another seller's folder. */
function assertPhotoOwnership(photos: readonly ListingPhoto[], sellerId: string): void {
  for (const photo of photos) {
    if (!isOwnedPhotoPath(photo.path, sellerId)) {
      throw new Error('photo path does not belong to seller');
    }
  }
}

async function insertPhotoRows(
  sb: NonNullable<ReturnType<typeof admin>>,
  listingId: string,
  photos: readonly ListingPhoto[],
): Promise<string | null> {
  const rows = orderedPhotoRows(photos).map((row) => ({ listing_id: listingId, ...row }));
  if (rows.length === 0) return null;
  const inserted = await sb.from('listing_photos').insert(rows);
  return inserted.error ? inserted.error.message : null;
}

/**
 * Publish one listing into Supabase. Returns the public slug.
 * Throws on any database error — the route turns that into a 500 and never
 * reports a listing that was not written.
 */
export async function publishHosted(input: HostedPublishInput): Promise<string> {
  const sb = admin();
  if (!sb) throw new Error('publishHosted called without Supabase credentials');

  const { data } = input;
  assertPhotoOwnership(data.photos, input.sellerId);
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

  const photoError = await insertPhotoRows(sb, listingId, data.photos);
  if (photoError) {
    // The listing exists but would render without its photos; drop it so the
    // publish either fully succeeds or fully fails.
    await sb.from('listings').delete().eq('id', listingId);
    throw new Error(`insert listing photos failed: ${photoError}`);
  }

  return slug;
}

/**
 * Edit a listing's editable fields and photo set (hosted mode).
 *
 * Ownership is resolved from the `listings` row, never from the request body.
 * A photo set replaces the previous one atomically in effect: the old rows are
 * read first and restored if the new insert fails.
 */
export async function updateHostedListing(input: {
  id: string;
  sellerId: string;
  patch: ListingPatch;
}): Promise<UpdateResult> {
  const sb = admin();
  if (!sb) return { ok: false, status: 500, message: 'hosted mode required' };

  const existing = await sb.from('listings').select('id, created_by').eq('id', input.id).maybeSingle();
  if (existing.error) {
    return { ok: false, status: 500, message: existing.error.message };
  }
  if (!existing.data) return { ok: false, status: 404, message: 'listing not found' };
  if (String(existing.data.created_by) !== input.sellerId) {
    return { ok: false, status: 403, message: 'not the owner' };
  }

  const { patch } = input;
  if (patch.photos) {
    try {
      assertPhotoOwnership(patch.photos, input.sellerId);
    } catch {
      return { ok: false, status: 403, message: 'photo path does not belong to seller' };
    }
  }

  const fields: Record<string, unknown> = {};
  if (patch.priceIRR !== undefined) fields.price_irr = patch.priceIRR;
  if (patch.description !== undefined) fields.description = patch.description;
  if (patch.city !== undefined) fields.city = patch.city;
  if (patch.allowPhoneReveal !== undefined) fields.allow_phone_reveal = patch.allowPhoneReveal;

  if (Object.keys(fields).length > 0) {
    const updated = await sb.from('listings').update(fields).eq('id', input.id);
    if (updated.error) {
      return { ok: false, status: 500, message: updated.error.message };
    }
  }

  if (patch.photos) {
    const previous = await sb
      .from('listing_photos')
      .select('storage_path, position, mime, bytes, width, height')
      .eq('listing_id', input.id);
    const removed = await sb.from('listing_photos').delete().eq('listing_id', input.id);
    if (removed.error) {
      return { ok: false, status: 500, message: removed.error.message };
    }
    const photoError = await insertPhotoRows(sb, input.id, patch.photos);
    if (photoError) {
      const previousRows = (previous.data ?? []) as Array<{
        storage_path: string;
        position: number;
        mime: string;
        bytes: number;
        width: number;
        height: number;
      }>;
      if (previousRows.length > 0) {
        await sb
          .from('listing_photos')
          .insert(previousRows.map((row) => ({ listing_id: input.id, ...row })));
      }
      return { ok: false, status: 500, message: photoError };
    }
  }

  return { ok: true };
}

/** Fixture-mode publish: same response shape, local JSON store. */
export function publishFixture(card: ListingCardData): string {
  addDevListing(card);
  return card.slug;
}

/** Dev card cover/gallery URLs for a photo set (fixture mode only). */
export function devPhotoUrls(photos: readonly ListingPhoto[]): { coverUrl: string | null; photos: string[] } {
  const ordered = orderedPhotoRows(photos);
  return {
    coverUrl: ordered[0] ? devPhotoUrl(ordered[0].storage_path) : null,
    photos: ordered.map((row) => devPhotoUrl(row.storage_path)),
  };
}
