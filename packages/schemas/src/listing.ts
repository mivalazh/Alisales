import { z } from 'zod';
import { citySlugs, vehicleSchema } from './vehicle';
import { listingStates, plateTypes, type ListingState } from './enums';

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
  priceIRR: z.number().int().min(0).max(10 ** 15),
  city: z.enum(citySlugs as [string, ...string[]]),
  description: z.string().trim().max(3000),
  photos: z.array(listingPhotoSchema).max(MAX_PHOTOS),
  showroomId: z.string().uuid().nullable().default(null),
  allowPhoneReveal: z.boolean().default(false),
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

/** Everything that must hold before a listing can go to pending_review. */
export const listingPublishSchema = listingBaseSchema
  .extend({
    description: z.string().trim().min(20).max(3000),
  })
  .superRefine(checkUniquePhotoPositions)
  .refine((v) => v.photos.length >= 1, {
    message: 'برای انتشار آگهی حداقل یک عکس لازم است',
    path: ['photos'],
  });

export type ListingPublish = z.infer<typeof listingPublishSchema>;

// ── State machine ────────────────────────────────────────────────────────────
/** Owner-initiated transitions. Admins/system may move any state to any state. */
export const listingTransitions: Record<ListingState, readonly ListingState[]> = {
  draft: ['pending_review'],
  pending_review: ['active', 'rejected', 'draft'],
  active: ['paused', 'sold', 'expired', 'pending_review'],
  paused: ['active', 'expired', 'sold'],
  sold: [],
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
