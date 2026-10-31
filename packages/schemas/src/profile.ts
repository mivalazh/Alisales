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
