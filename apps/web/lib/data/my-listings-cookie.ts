import { cookies } from 'next/headers';
import type { ListingCardData } from './listings';
import { authSecret, hmacSha256 } from '../auth/session';

/**
 * The seller's own recent publishes, carried in a **signed** cookie.
 *
 * On the hosted preview the demo store lives in isolate memory (no filesystem),
 * so a listing published by one request can be invisible to the next request if
 * it lands on another isolate — the seller would click «انتشار آگهی» and get a
 * 404 on their own listing. The API therefore also writes a compact snapshot of
 * the new card into this cookie, and every read path merges it back in.
 *
 * This is a demo/preview bridge, not the durable store: it is per-browser (only
 * the seller sees their own listing), capped at a handful of entries, and it is
 * signed with the session secret so a browser cannot inject arbitrary listings.
 * A hosted deployment with Supabase never needs it.
 */

export const MY_LISTINGS_COOKIE = 'alisales_my_listings';
/** Cookie budget: a handful of compact cards keeps us far under 4 KB. */
const MAX_ENTRIES = 4;

type CompactCard = Pick<
  ListingCardData,
  | 'id'
  | 'slug'
  | 'sellerId'
  | 'priceIRR'
  | 'city'
  | 'state'
  | 'featured'
  | 'publishedAt'
  | 'brand'
  | 'model'
  | 'trim'
  | 'year'
  | 'mileageKm'
  | 'gearbox'
  | 'fuel'
  | 'color'
  | 'condition'
  | 'plateType'
  | 'coverUrl'
  | 'showroomName'
  | 'showroomVerified'
  | 'allowPhoneReveal'
  | 'hideAed'
  | 'kind'
  | 'part'
> & { hasReport: boolean };

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function compact(card: ListingCardData): CompactCard {
  return {
    id: card.id,
    slug: card.slug,
    sellerId: card.sellerId,
    priceIRR: card.priceIRR,
    city: card.city,
    state: card.state,
    featured: card.featured,
    publishedAt: card.publishedAt,
    brand: card.brand,
    model: card.model,
    trim: card.trim,
    year: card.year,
    mileageKm: card.mileageKm,
    gearbox: card.gearbox,
    fuel: card.fuel,
    color: card.color,
    condition: card.condition,
    plateType: card.plateType,
    coverUrl: card.coverUrl,
    showroomName: card.showroomName,
    showroomVerified: card.showroomVerified,
    allowPhoneReveal: card.allowPhoneReveal,
    hideAed: card.hideAed ?? false,
    kind: card.kind,
    part: card.part ?? null,
    hasReport: card.hasReport,
  };
}

/** Reads the current seller's signed snapshot; tampered or absent → []. */
export async function readMyListings(): Promise<ListingCardData[]> {
  let raw: string | undefined;
  try {
    raw = (await cookies()).get(MY_LISTINGS_COOKIE)?.value;
  } catch {
    return []; // outside a request (tests, static renders)
  }
  if (!raw) return [];

  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature) return [];

  const secret = authSecret();
  if (!secret) return [];
  const expected = await hmacSha256(secret, encoded);
  if (expected !== signature) return [];

  const json = fromBase64Url(encoded);
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is ListingCardData =>
        Boolean(entry) && typeof (entry as ListingCardData).slug === 'string',
    );
  } catch {
    return [];
  }
}

/** Merges the snapshot into a listing feed, newest first, without duplicates. */
export function mergeMyListings(
  mine: readonly ListingCardData[],
  feed: readonly ListingCardData[],
): ListingCardData[] {
  if (mine.length === 0) return [...feed];
  const seen = new Set(feed.map((l) => l.slug));
  return [...mine.filter((l) => !seen.has(l.slug)), ...feed];
}

/** Drops a deleted listing from the signed snapshot (route-handler context). */
export async function forgetMyListing(slug: string): Promise<void> {
  const secret = authSecret();
  if (!secret) return;
  const previous = await readMyListings();
  const next = previous.filter((listing) => listing.slug !== slug);
  if (next.length === previous.length) return;
  const encoded = toBase64Url(JSON.stringify(next.map(compact)));
  const signature = await hmacSha256(secret, encoded);
  try {
    (await cookies()).set(MY_LISTINGS_COOKIE, `${encoded}.${signature}`, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === 'production',
    });
  } catch {
    // Read-only context; the store deletion is still authoritative.
  }
}

/** Appends a just-published card to the cookie (route-handler context only). */
export async function rememberMyListing(card: ListingCardData): Promise<void> {
  const secret = authSecret();
  if (!secret) return;

  const previous = await readMyListings();
  const next = [card, ...previous.filter((l) => l.slug !== card.slug)].slice(0, MAX_ENTRIES);
  const encoded = toBase64Url(JSON.stringify(next.map(compact)));
  const signature = await hmacSha256(secret, encoded);

  try {
    (await cookies()).set(MY_LISTINGS_COOKIE, `${encoded}.${signature}`, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === 'production',
    });
  } catch {
    // A read-only context cannot set cookies; the listing is still in the store.
  }
}
