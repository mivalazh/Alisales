import { z } from 'zod';

/**
 * Account profile (S2 / C4): the first login collects a display name and an
 * account type. There is deliberately no buyer/seller role anywhere — every
 * account can browse, chat, save and post.
 */
export const accountTypes = ['individual', 'showroom'] as const;
export type AccountType = (typeof accountTypes)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  individual: 'فردی',
  showroom: 'نمایشگاه',
};

/** Public-facing profile mode — personal privacy vs a business storefront. */
export const profileModes = ['personal', 'business'] as const;
export type ProfileMode = (typeof profileModes)[number];

export const PROFILE_MODE_LABELS: Record<ProfileMode, string> = {
  personal: 'حساب شخصی',
  business: 'حساب کسب‌وکار',
};

/** Business sub-type shown on the profile and in settings. */
export const businessTypes = [
  'car-dealer',
  'parts-store',
  'workshop',
  'rental',
] as const;
export type BusinessType = (typeof businessTypes)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  'car-dealer': 'نمایشگاه خودرو',
  'parts-store': 'فروشگاه قطعات',
  workshop: 'تعمیرگاه',
  rental: 'رنت‌کار',
};

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, { message: 'نام باید دست‌کم ۲ نویسه باشد' })
  .max(60, { message: 'نام نمی‌تواند بیش از ۶۰ نویسه باشد' });

export const profileSchema = z.object({
  displayName: displayNameSchema,
  accountType: z.enum(accountTypes),
});

export type ProfileInput = z.infer<typeof profileSchema>;

/** Short label used in the profile header. */
export function accountTypeLabel(type: AccountType): string {
  return ACCOUNT_TYPE_LABELS[type];
}

/** Map the stored account kind to the personal/business profile model. */
export function profileModeFor(type: AccountType): ProfileMode {
  return type === 'showroom' ? 'business' : 'personal';
}
