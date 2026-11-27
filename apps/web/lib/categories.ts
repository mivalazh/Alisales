/**
 * The four catalogue categories, exactly as the hamburger menu names and
 * draws them.
 *
 * One source for the drawer and the publish form's category tiles, so the
 * label, the English label and the artwork (`/icons/menu/*.svg`) can never
 * drift apart between the two surfaces.
 */
export const MENU_CATEGORY = {
  car: {
    label: 'خودرو',
    en: 'Cars',
    href: '/cars',
    iconSrc: '/icons/menu/khodro.svg',
  },
  motorcycle: {
    label: 'موتور و اسکوتر برقی',
    en: 'Electric bikes & scooters',
    href: '/motorcycles',
    iconSrc: '/icons/menu/motorcycle.svg',
  },
  heavy: {
    label: 'ماشین‌آلات سنگین',
    en: 'Heavy machinery',
    href: '/heavy',
    iconSrc: '/icons/menu/truck-empty-1.svg',
  },
  parts: {
    label: 'قطعات و لوازم یدکی',
    en: 'Spare parts',
    href: '/parts',
    iconSrc: '/icons/menu/wrench.svg',
  },
} as const;

export type MenuCategoryKey = keyof typeof MENU_CATEGORY;

/** Menu order — vehicles first, parts last. */
export const MENU_CATEGORIES = [
  MENU_CATEGORY.car,
  MENU_CATEGORY.motorcycle,
  MENU_CATEGORY.heavy,
  MENU_CATEGORY.parts,
] as const;
