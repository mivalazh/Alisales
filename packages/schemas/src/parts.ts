import { z } from 'zod';
import { citySlugs } from './vehicle';
import { MAX_PHOTOS, listingPhotoSchema } from './listing';

/**
 * Parts & accessories listings (`parts_listings` flag).
 *
 * Step 1 of the create form selects خودرو or قطعه و لوازم جانبی. A part has a
 * category instead of brand/model/year, an optional part number and an
 * optional compatibility line that displays as «سازگاری عمومی» when empty.
 */

export const partCategories = [
  'engine',
  'brake',
  'body',
  'electrical',
  'interior',
  'tires',
  'oil_filters',
  'other',
] as const;
export type PartCategory = (typeof partCategories)[number];

export const PART_CATEGORY_LABELS: Record<PartCategory, string> = {
  engine: 'موتور و انتقال قدرت',
  brake: 'ترمز و تعلیق',
  body: 'بدنه و آپشن',
  electrical: 'برق و روشنایی',
  interior: 'داخل کابین',
  tires: 'لاستیک و رینگ',
  oil_filters: 'روغن و فیلتر',
  other: 'سایر',
};

export const partOrigins = ['original', 'commercial', 'unknown'] as const;
export type PartOrigin = (typeof partOrigins)[number];

export const PART_ORIGIN_LABELS: Record<PartOrigin, string> = {
  original: 'اصل',
  commercial: 'تجاری',
  unknown: 'نامشخص',
};

export const partConditions = ['new', 'used'] as const;
export type PartCondition = (typeof partConditions)[number];

export const PART_CONDITION_LABELS: Record<PartCondition, string> = {
  new: 'نو',
  used: 'کارکرده',
};

export const PART_COMPATIBILITY_GENERAL = 'سازگاری عمومی';

/** Compatibility text shown on cards and detail («سازگاری عمومی» when empty). */
export function compatibilityLabel(compatibility: string | null | undefined): string {
  const trimmed = compatibility?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : PART_COMPATIBILITY_GENERAL;
}

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

export const partListingPublishSchema = z
  .object({
    kind: z.literal('part'),
    category: z.enum(partCategories, { message: 'دسته‌بندی قطعه را انتخاب کنید' }),
    title: z
      .string()
      .trim()
      .min(3, { message: 'عنوان باید دست‌کم ۳ نویسه باشد' })
      .max(80, { message: 'عنوان نمی‌تواند بیش از ۸۰ نویسه باشد' }),
    partNumber: z.string().trim().max(32).nullable().default(null),
    compatibility: z.string().trim().max(80).nullable().default(null),
    origin: z.enum(partOrigins, { message: 'منشأ قطعه را انتخاب کنید' }),
    condition: z.enum(partConditions, { message: 'وضعیت قطعه را انتخاب کنید' }),
    warranty: z.string().trim().max(60).nullable().default(null),
    priceIRR: z.number().int().min(0).max(10 ** 15),
    city: z.enum(citySlugs as [string, ...string[]]),
    description: z.string().trim().min(10).max(3000),
    photos: z.array(listingPhotoSchema).max(MAX_PHOTOS),
    showroomId: z.string().uuid().nullable().default(null),
    allowPhoneReveal: z.boolean().default(false),
  })
  .superRefine(checkUniquePhotoPositions)
  .refine((v) => v.photos.length >= 1, {
    message: 'برای انتشار آگهی حداقل یک عکس لازم است',
    path: ['photos'],
  });

export type PartListingPublish = z.infer<typeof partListingPublishSchema>;

/** Human labels for part form paths — in-line فارسی errors. */
export const PART_FIELD_LABELS: Record<string, string> = {
  category: 'دسته‌بندی',
  title: 'عنوان',
  partNumber: 'شماره فنی',
  compatibility: 'سازگاری با خودرو',
  origin: 'منشأ',
  condition: 'وضعیت',
  warranty: 'گارانتی',
  priceIRR: 'قیمت',
  city: 'شهر',
  description: 'توضیحات',
  photos: 'عکس‌ها',
  allowPhoneReveal: 'نمایش شماره تماس',
};
