/**
 * Read-only plan preview (the third-listing gate).
 *
 * Prices are not shown: both cards render «بزودی» and «انتخاب پلن» only opens
 * the «بزودی» notice. There is no checkout, no payment request and no
 * subscription write here — `subscriptions` stays off in feature flags and
 * `subscription_payments` is untouched.
 */
export const PLAN_PREVIEW_SOON = 'بزودی';

export interface PlanPreviewCard {
  code: 'personal' | 'showroom';
  name: string;
  listingLimit: number;
  durationDays: number;
  bumpsPerDay: number;
  features: readonly string[];
}

export const PLAN_PREVIEWS: readonly PlanPreviewCard[] = [
  {
    code: 'personal',
    name: 'پلن شخصی',
    listingLimit: 5,
    durationDays: 30,
    bumpsPerDay: 1,
    features: ['تا ۵ آگهی فعال', 'نمایش ۳۰ روزه', 'یک آپدیت (بامپ) فعال'],
  },
  {
    code: 'showroom',
    name: 'پلن نمایشگاه و تعمیرگاه',
    listingLimit: 50,
    durationDays: 90,
    bumpsPerDay: 3,
    features: ['تا ۵۰ آگهی فعال', 'نمایش ۹۰ روزه', 'تا ۳ بامپ در روز', 'استوری', 'آمار کامل'],
  },
] as const;
