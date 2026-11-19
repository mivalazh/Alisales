'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

/**
 * Top-level category switch: خودرو | موتور و اسکوتر برقی | ماشین‌آلات سنگین |
 * قطعات.
 *
 * One centered, line-style tab row shared by the home page and every browse
 * page. The row sits on the page's cream surface (no chip/card fills) and the
 * active tab is marked by ink-coloured text plus a short orange underline, so
 * it reads as navigation rather than as filter pills.
 */
const CATEGORIES: ReadonlyArray<{ href: string; label: string; short: string }> = [
  { href: '/cars', label: 'خودرو', short: 'خودرو' },
  { href: '/motorcycles', label: 'موتور و اسکوتر برقی', short: 'موتور و اسکوتر' },
  { href: '/heavy', label: 'ماشین‌آلات سنگین', short: 'ماشین‌آلات' },
  { href: '/parts', label: 'قطعات', short: 'قطعات' },
];

export function CategorySwitch() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      aria-label={t('دسته‌بندی‌ها', 'Categories')}
      className="-mx-4 mt-3 bg-page px-2 sm:mx-0 sm:px-0"
    >
      <ul className="flex items-stretch justify-center gap-1 border-b border-line sm:gap-2">
        {CATEGORIES.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-11 items-center justify-center whitespace-nowrap px-2.5 text-[11px] font-extrabold leading-tight transition sm:px-4 sm:text-sm ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                <span className="sm:hidden">{t(item.short)}</span>
                <span className="hidden sm:inline">{t(item.label)}</span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-2 -bottom-px h-[2px] rounded-full transition-opacity ${
                    active ? 'bg-[#F98513]' : 'bg-transparent'
                  }`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
