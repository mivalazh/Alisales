import { z } from 'zod';
import { toLatinDigits } from './digits';
import { citySlugs, vehicleSchema } from './vehicle';
import { listingStates, plateTypes, type ListingState } from './enums';
import { bikeTypeKeys, heavyTypeKeys, vehicleCategories } from './categories';

// ── Photo pipeline rules ─────────────────────────────────────────────────────
export const MAX_PHOTOS = 20;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB after webp conversion
export const ALLOWED_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Short clips uploaded next to the photos (never as the cover). */
export const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
export const MAX_VIDEO_BYTES = 40 * 1024 * 1024; // 40 MB per clip
export const ALLOWED_MEDIA_MIME = [...ALLOWED_PHOTO_MIME, ...ALLOWED_VIDEO_MIME] as const;

export function isVideoMime(mime: string): boolean {
  return (ALLOWED_VIDEO_MIME as readonly string[]).includes(mime);
}

export const listingPhotoSchema = z.object({
  path: z.string().min(3).max(300), // storage path: {owner}/{listing}/{n}.webp
  mime: z.enum(ALLOWED_MEDIA_MIME),
  bytes: z.number().int().positive().max(MAX_VIDEO_BYTES),
  width: z.number().int().positive().max(20_000),
  height: z.number().int().positive().max(20_000),
  position: z.number().int().min(0).max(MAX_PHOTOS - 1),
});
export type ListingPhoto = z.infer<typeof listingPhotoSchema>;

/**
 * A price in IRR, tolerant of how people actually type it.
 *
 * `"54,400,000,000"`, `"۵۴٬۴۰۰٬۰۰۰٬۰۰۰"` and `544000000000` all mean the same
 * stored integer. Anything that is not a positive integer inside the ceiling is
 * rejected with the price field's own message rather than a generic type error.
 */
export const priceAmountSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const cleaned = toLatinDigits(value).replace(/[٬,\s]/g, '');
    return cleaned === '' ? undefined : Number(cleaned);
  }
  return value;
}, z.number().int().positive().max(10 ** 15));

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
  /**
   * Stored in IRR. Typed input arrives as a string, often with thousands
   * separators and sometimes in Persian/Arabic digits; it is normalised here so
   * a correctly typed price is never rejected as a wrong *type*. The ceiling is
   * high enough for a 500-billion-toman luxury listing (5,000,000,000,000 IRR)
   * with room to spare, and stays far from 32-bit overflow.
   */
  priceIRR: priceAmountSchema,
  city: z.enum(citySlugs as [string, ...string[]]),
  description: z.string().trim().max(3000),
  photos: z.array(listingPhotoSchema).max(MAX_PHOTOS),
  showroomId: z.string().uuid().nullable().default(null),
  /** Phone numbers are visible by default; the checkbox opts out. */
  allowPhoneReveal: z.boolean().default(true),
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

/** Image slots keep the 8 MB photo ceiling; clips get the larger video one. */
function checkMediaSize(
  val: { photos: Array<{ mime: string; bytes: number }> },
  ctx: z.RefinementCtx,
): void {
  for (const [i, p] of val.photos.entries()) {
    if (!isVideoMime(p.mime) && p.bytes > MAX_PHOTO_BYTES) {
      ctx.addIssue({
        code: 'custom',
        message: 'حجم عکس بیش از ۸ مگابایت است.',
        path: ['photos', i, 'bytes'],
      });
    }
  }
}

/** The cover slot is always a still image — a video may follow it. */
function checkCoverIsPhoto(
  val: { photos: Array<{ position: number; mime: string }> },
  ctx: z.RefinementCtx,
): void {
  for (const [i, p] of val.photos.entries()) {
    if (p.position === 0 && isVideoMime(p.mime)) {
      ctx.addIssue({
        code: 'custom',
        message: 'تصویر اول (کاور آگهی) باید عکس باشد؛ در اسلات‌های بعدی می‌توانید ویدیو هم اضافه کنید',
        path: ['photos', i, 'mime'],
      });
    }
  }
}

export const listingDraftSchema = listingBaseSchema
  .superRefine(checkUniquePhotoPositions)
  .superRefine(checkMediaSize)
  .superRefine(checkCoverIsPhoto);

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
  .superRefine(checkUniquePhotoPositions)
  .superRefine(checkMediaSize)
  .superRefine(checkCoverIsPhoto);

export type ListingPublish = z.infer<typeof listingPublishSchema>;

/** Human labels for schema paths — inline فارسی errors in web & mobile forms. */
export const LISTING_FIELD_LABELS: Record<string, string> = {
  'vehicle.brand': 'برند',
  'vehicle.model': 'مدل',
  'vehicle.trim': 'تیپ / کلاس بدنه',
  'vehicle.bodyType': 'تیپ / کلاس بدنه',
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
