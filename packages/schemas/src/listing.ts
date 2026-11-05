import { z } from 'zod';
import { citySlugs, vehicleSchema } from './vehicle';
import { listingStates, plateTypes, type ListingState } from './enums';
import { bikeTypeKeys, heavyTypeKeys, vehicleCategories } from './categories';

// ── Photo pipeline rules ─────────────────────────────────────────────────────
export const MAX_PHOTOS = 20;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB after webp conversion
export const ALLOWED_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const listingPhotoSchema = z.object({
  path: z.string().min(3).max(300), // storage path: {owner}/{listing}/{n}.webp
  mime: z.enum(ALLOWED_PHOTO_MIME),
  bytes: z.number().int().positive().max(MAX_PHOTO_BYTES),
  width: z.number().int().positive().max(20_000),
  height: z.number().int().positive().max(20_000),
  position: z.number().int().min(0).max(MAX_PHOTOS - 1),
});
export type ListingPhoto = z.infer<typeof listingPhotoSchema>;

// ── Listing input (draft-tolerant) ───────────────────────────────────────────
const listingBaseSchema = z.object({
  vehicle: vehicleSchema,
  /**
   * Top-level category the seller picked first: خودرو / موتورسیکلت /
   * ماشین‌آلات سنگین. Parts have their own payload (`kind: 'part'`).
   */
  category: z.enum(vehicleCategories).optional(),
  /** Motorcycle engine displacement (cc). */
  engineCc: z.number().int().min(0).max(3000).nullable().optional(),
  /** Two-wheeler class: اسکوتر برقی / موتور برقی / اسپرت / کلاسیک … */
  bikeType: z.enum(bikeTypeKeys).nullable().optional(),
  /** Heavy machinery class: کامیون / کشنده / بیل مکانیکی … */
  heavyType: z.enum(heavyTypeKeys).nullable().optional(),
  /** Heavy machinery working hours (instead of a mileage). */
  workingHours: z.number().int().min(0).max(500_000).nullable().optional(),
  priceIRR: z.number().int().min(0).max(10 ** 15),
  city: z.enum(citySlugs as [string, ...string[]]),
  description: z.string().trim().max(3000),
  photos: z.array(listingPhotoSchema).max(MAX_PHOTOS),
  showroomId: z.string().uuid().nullable().default(null),
  allowPhoneReveal: z.boolean().default(false),
  /** Hide the «≈ … AED» reference line on this listing (Toman-only). */
  hideAed: z.boolean().default(false),
});

function checkUniquePhotoPositions(
  val: { photos: Array<{ position: number }> },
  ctx: z.RefinementCtx,
): void {
  const positions = new Set<number>();
  for (const [i, p] of val.photos.entries()) {
    if (positions.has(p.position)) {
      ctx.addIssue({
        code: 'custom',
        message: 'موقعیت تکراری عکس',
        path: ['photos', i, 'position'],
      });
    }
    positions.add(p.position);
  }
}

export const listingDraftSchema = listingBaseSchema.superRefine(checkUniquePhotoPositions);

export type ListingDraft = z.infer<typeof listingDraftSchema>;

/**
 * Everything that must hold before a listing can go to pending_review.
 *
 * Photos are optional: a seller can publish text-only and the API assigns a
 * default cover, so a submission without a local file still succeeds.
 */
export const listingPublishSchema = listingBaseSchema
  .extend({
    /**
     * Fully optional: sellers can publish with no description at all (or a
     * single word). The detail page prints a neutral placeholder instead of an
     * empty block, so nothing here needs a minimum length.
     */
    description: z.string().trim().max(3000),
  })
  .superRefine(checkUniquePhotoPositions);

export type ListingPublish = z.infer<typeof listingPublishSchema>;

/** Human labels for schema paths — inline فارسی errors in web & mobile forms. */
export const LISTING_FIELD_LABELS: Record<string, string> = {
  'vehicle.brand': 'برند',
  'vehicle.model': 'مدل',
  'vehicle.trim': 'تیپ',
  'vehicle.year': 'سال ساخت',
  'vehicle.mileageKm': 'کارکرد',
  'vehicle.gearbox': 'گیربکس',
  'vehicle.fuel': 'سوخت',
  'vehicle.color': 'رنگ',
  'vehicle.condition': 'وضعیت خودرو',
  'vehicle.plateType': 'وضعیت پلاک',
  'vehicle.vin': 'شماره شاسی (VIN)',
  category: 'دسته‌بندی',
  engineCc: 'حجم موتور',
  bikeType: 'نوع موتور',
  heavyType: 'نوع ماشین‌آلات',
  workingHours: 'ساعت کارکرد',
  priceIRR: 'قیمت',
  city: 'شهر',
  description: 'توضیحات',
  photos: 'عکس‌ها',
  allowPhoneReveal: 'نمایش شماره تماس',
  hideAed: 'نمایش قیمت درهم',
};

// ── State machine ────────────────────────────────────────────────────────────
/** Owner-initiated transitions. Admins/system may move any state to any state. */
export const listingTransitions: Record<ListingState, readonly ListingState[]> = {
  draft: ['pending_review'],
  pending_review: ['active', 'rejected', 'draft'],
  active: ['paused', 'sold', 'expired', 'pending_review'],
  paused: ['active', 'expired', 'sold'],
  // Reactivation (Phase 2 / D2): a sold listing keeps its sold position in the
  // catalog but the owner may bring it back to active; the migration clears
  // sold_at and refreshes published_at/expires_at on that transition.
  sold: ['active'],
  expired: ['draft'],
  rejected: ['draft'],
};

export type TransitionActor = 'owner' | 'admin' | 'system';

export function canTransition(from: ListingState, to: ListingState, actor: TransitionActor): boolean {
  if (from === to) return false;
  if (actor === 'admin' || actor === 'system') return true;
  return listingTransitions[from].includes(to);
}

export function isSlotState(state: ListingState): boolean {
  // States that consume a plan's listing slot (drafts included, so limits can't be bypassed).
  return state === 'draft' || state === 'pending_review' || state === 'active' || state === 'paused';
}

export { listingStates, plateTypes };
