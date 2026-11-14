/**
 * Legacy plan-preview copy and card data.
 *
 * The web PlanPreview component has been removed. These values stay exported
 * because shared schema tests lock their limits and the «بزودی» label; no web
 * surface consumes them and there is no checkout or subscription write.
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
