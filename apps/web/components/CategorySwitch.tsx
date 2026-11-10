'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

/**
 * Top-level category switch: خودرو | موتور و اسکوتر برقی | ماشین‌آلات سنگین |
 * قطعات.
 *
 * One hairline bar, shared by the home page and every browse page. The previous
 * 2×2 boxed grid ate a third of a phone screen before any results; this is a
 * single 40px row of label-only tabs divided by 1px lines, with the active tab
 * carrying an orange underline on the ink colour.
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
    <nav aria-label={t('دسته‌بندی‌ها', 'Categories')} className="border-y border-line">
      <ul className="flex items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((item, index) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li
              key={item.href}
              className={`min-w-0 flex-1 ${index > 0 ? 'border-s border-line' : ''}`}
            >
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-10 items-center justify-center px-1 text-center text-[11px] font-extrabold leading-tight transition sm:text-sm ${
                  active ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                <span className="sm:hidden">{t(item.short)}</span>
                <span className="hidden sm:inline">{t(item.label)}</span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#F98513]"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
