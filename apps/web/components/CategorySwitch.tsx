'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

/**
 * Top-level category switch: خودرو | موتور و اسکوتر برقی | ماشین‌آلات سنگین |
 * قطعات.
 *
 * One row of rounded pills, shared by the home page and every browse page and
 * separated from the fixed header by a small top margin, so the tabs never
 * read as part of the header bar. The active pill carries the brand orange.
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
      className="-mx-4 mt-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
    >
      <ul className="flex items-center gap-2">
        {CATEGORIES.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-9 items-center whitespace-nowrap rounded-[var(--radius-pill)] border px-3.5 text-[11px] font-extrabold leading-tight transition sm:text-sm ${
                  active
                    ? 'border-[#F98513] bg-[#F98513] text-white shadow-xs'
                    : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                <span className="sm:hidden">{t(item.short)}</span>
                <span className="hidden sm:inline">{t(item.label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
