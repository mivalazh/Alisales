'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { IconName } from './Icon';
import { Icon } from './Icon';

/**
 * Top-level category switch: خودرو | موتورسیکلت | ماشین‌آلات سنگین | قطعات.
 *
 * One row of four destinations, shared by the home page and every browse page,
 * so a buyer can move between markets without going back through the menu.
 */
const CATEGORIES: ReadonlyArray<{ href: string; label: string; icon: IconName }> = [
  { href: '/cars', label: 'خودرو', icon: 'car' },
  { href: '/motorcycles', label: 'موتورسیکلت', icon: 'plate' },
  { href: '/heavy', label: 'ماشین‌آلات سنگین', icon: 'gear' },
  { href: '/parts', label: 'قطعات', icon: 'tag' },
];

export function CategorySwitch() {
  const pathname = usePathname();

  return (
    <nav aria-label="دسته‌بندی‌ها" className="rounded-card border border-line bg-card p-1.5">
      <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {CATEGORIES.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center justify-center gap-1.5 rounded-field px-2 py-2.5 text-xs font-extrabold transition sm:text-sm ${
                  active
                    ? 'bg-cta-soft text-ink'
                    : 'text-muted hover:bg-sunken hover:text-ink'
                }`}
              >
                <Icon name={item.icon} size={16} className={active ? 'text-cta' : undefined} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
