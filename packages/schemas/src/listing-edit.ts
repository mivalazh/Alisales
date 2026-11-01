import { z } from 'zod';
import { citySlugs } from './vehicle';
import { MAX_PHOTOS, listingPhotoSchema } from './listing';

/**
 * Listing edit rules (owner PATCH).
 *
 * Only the fields a seller may change after publishing are accepted. Identity
 * (brand/model/year/VIN), lifecycle (`state`), ranking (`featured`) and the
 * posting clock (`published_at`, `expires_at`, `sold_at`) are deliberately
 * absent: Zod strips unknown keys, so a browser that sends `publishedAt` or
 * `state` cannot move the posting age. State changes have their own endpoint
 * and lifecycle rules (`listingTransitions`).
 */
export const LISTING_EDIT_LOCKED_FIELDS = [
  'id',
  'slug',
  'sellerId',
  'seller_id',
  'created_at',
  'published_at',
  'publishedAt',
  'expires_at',
  'sold_at',
  'featured',
  'state',
] as const;

export const listingEditSchema = z
  .object({
    priceIRR: z.number().int().min(0).max(10 ** 15).optional(),
    // Parts descriptions may be as short as 10 characters (part schema), so
    // the edit floor follows the shorter of the two publish rules.
    description: z.string().trim().min(10).max(3000).optional(),
    city: z.enum(citySlugs as [string, ...string[]]).optional(),
    allowPhoneReveal: z.boolean().optional(),
    photos: z.array(listingPhotoSchema).min(1).max(MAX_PHOTOS).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'هیچ تغییری ارسال نشده است.',
  });

export type ListingEdit = z.infer<typeof listingEditSchema>;

/** States an owner may set from the «آگهی‌های من» row actions. */
export const ownerStateTargets = ['active', 'paused', 'sold'] as const;
export type OwnerStateTarget = (typeof ownerStateTargets)[number];

export const listingStateChangeSchema = z.object({
  state: z.enum(ownerStateTargets),
});

/**
 * Reference rate for the AED/Toman price switch in the editor.
 *
 * Display/entry helper only: the stored value is always IRR and no payment or
 * checkout path reads this. Pricing changes stay behind finance sign-off.
 */
export const AED_TO_IRR = 272_000;
export const IRR_PER_TOMAN = 10;

export function aedToIRR(aed: number): number {
  return Math.round(aed * AED_TO_IRR);
}

export function irrToAED(irr: number): number {
  return Math.round(irr / AED_TO_IRR);
}

export function tomanToIRR(toman: number): number {
  return Math.round(toman * IRR_PER_TOMAN);
}

export function irrToToman(irr: number): number {
  return Math.round(irr / IRR_PER_TOMAN);
}
