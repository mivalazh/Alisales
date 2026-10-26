import type { IconName } from '@studio/design';

/**
 * The five product destinations — identical on every device; only their
 * placement differs (bottom bar on phone width, top bar in the header on
 * tablet/desktop, both listing items in this exact left-to-right order).
 * The raised center item is `post`.
 */
export interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: IconName;
  /** Center raised action (ثبت آگهی). */
  primary?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'home', href: '/', label: 'خانه', icon: 'home' },
  { key: 'chats', href: '/chats', label: 'چت‌ها', icon: 'message' },
  { key: 'post', href: '/new', label: 'ثبت آگهی', icon: 'plus', primary: true },
  { key: 'favorites', href: '/favorites', label: 'علاقه‌مندی‌ها', icon: 'heart' },
  { key: 'profile', href: '/profile', label: 'پروفایل', icon: 'user' },
] as const;
