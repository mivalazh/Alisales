'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from '@/lib/nav';
import { Icon } from './Icon';

/**
 * Fixed bottom bar — phone width only (sm:hidden); tablet/desktop carry the
 * same five destinations in the header's top bar. Items render left-to-right
 * in NAV_ITEMS order; the center ثبت آگهی action is raised.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul dir="ltr" className="mx-auto flex h-16 w-full max-w-lg items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          if (item.primary) {
            return (
              <li key={item.key} className="flex flex-1 items-start justify-center">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-cta text-ink shadow-lg transition active:translate-y-0.5"
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
                className={`flex w-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
                  active ? 'text-ink' : 'text-faint'
                }`}
              >
                <Icon name={item.icon} size={22} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
