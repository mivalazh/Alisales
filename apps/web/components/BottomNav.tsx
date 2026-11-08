'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { NAV_ITEMS } from '@/lib/nav';
import { Icon } from './Icon';
import { useActivePath } from './useActivePath';

const EN_LABELS: Record<string, string> = {
  home: 'Home',
  chats: 'Chats',
  post: 'Post ad',
  favorites: 'Saved',
  profile: 'Profile',
};

/**
 * Fixed bottom bar — phone width only (sm:hidden); tablet/desktop carry the
 * same five destinations in the header's top bar. Items render left-to-right
 * in NAV_ITEMS order; the center ثبت آگهی action is raised.
 *
 * It stays visible on the publish flow so the success screen never strands a
 * phone user without navigation.
 */
export function BottomNav() {
  const pathname = usePathname();
  const isActive = useActivePath();
  const { t } = useI18n();

  // The inspection report is a focused reading screen; everything else keeps
  // the bar, including the post-publish success state.
  if (pathname?.includes('/inspection')) {
    return null;
  }

  return (
    <nav
      aria-label={t('ناوبری اصلی', 'Main navigation')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul dir="ltr" className="mx-auto flex h-16 w-full max-w-lg items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const label = t(item.label, EN_LABELS[item.key] ?? item.label);
          if (item.primary) {
            return (
              <li key={item.key} className="flex flex-1 items-start justify-center">
                <Link
                  href={item.href}
                  aria-label={label}
                  className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg ring-4 ring-card transition active:translate-y-0.5"
                  style={{ background: '#F98513' }}
                >
                  <Icon name={item.icon} size={26} />
                </Link>
              </li>
            );
          }
          return (
            <li key={item.key} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full flex-col items-center justify-center gap-1 text-[11px] transition ${
                  active ? 'font-extrabold' : 'font-bold'
                }`}
                style={{ color: active ? '#F98513' : '#64748B' }}
              >
                <Icon name={item.icon} size={22} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
