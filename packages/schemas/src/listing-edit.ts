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
    // Descriptions are optional everywhere (a listing may ship with none), so
    // the edit rule has no minimum either.
    description: z.string().trim().max(3000).optional(),
    city: z.enum(citySlugs as [string, ...string[]]).optional(),
    allowPhoneReveal: z.boolean().optional(),
    /**
     * Replacement photo set. An empty array is allowed: photos are optional at
     * publish, so a photo-less listing must stay editable (the cover falls back
     * to the catalogue default).
     */
    photos: z.array(listingPhotoSchema).max(MAX_PHOTOS).optional(),
    /** «فقط تومان» price preference (Toman-only, no AED reference line). */
    hideAed: z.boolean().optional(),
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
 * AED/Toman entry helpers.
 *
 * The conversion itself lives in `./rate` (one source for the rate). These
 * re-exports stay for the existing import sites; every function takes the
 * caller's live rate, defaulting to the launch reference so a call with no
 * argument behaves exactly as before.
 *
 * Display/entry helper only: the stored value is always IRR and no payment or
 * checkout path reads this. Pricing changes stay behind finance sign-off.
 */
export {
  DEFAULT_AED_TO_IRR,
  AED_TO_IRR,
  IRR_PER_TOMAN,
  aedToIRR,
  irrToAED,
  tomanToIRR,
  irrToToman,
} from './rate';
export type { AedRate, RateSource } from './rate';
