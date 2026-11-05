'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Top-level category switch: خودرو | موتور و اسکوتر برقی | ماشین‌آلات سنگین |
 * قطعات.
 *
 * One row of four destinations, shared by the home page and every browse page,
 * so a buyer can move between markets without going back through the menu. The
 * tabs are label-only: a decorative outline icon next to every word added
 * noise without adding information.
 */
const CATEGORIES: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/cars', label: 'خودرو' },
  { href: '/motorcycles', label: 'موتور و اسکوتر برقی' },
  { href: '/heavy', label: 'ماشین‌آلات سنگین' },
  { href: '/parts', label: 'قطعات' },
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
                className={`flex items-center justify-center rounded-field px-2 py-2.5 text-xs font-extrabold transition sm:text-sm ${
                  active
                    ? 'bg-cta-soft text-ink'
                    : 'text-muted hover:bg-sunken hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
