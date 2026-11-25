'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

/**
 * Top-level category switch: خودرو | موتور و اسکوتر | ماشین‌آلات | قطعات.
 *
 * A balanced four-column table strip: equal-width cells divided by hairline
 * rules, page-cream fill, and the active cell marked by ink text plus a short
 * orange indicator on the shared bottom rule. It is navigation, not filters.
 *
 * The strip is one closed container — outer `border` + `rounded-xl` — instead
 * of a top/bottom-only rule, so RTL shows the same closing edge on both ends
 * (the first tab sits at the right edge, the last at the left) and the bar
 * matches the banner and the search/filter surfaces under it. The internal
 * dividers are the only lines inside it.
 *
 * Every tab prefetches its route so stepping between the four browse pages is
 * instant on a phone connection.
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
    <nav aria-label={t('دسته‌بندی‌ها', 'Categories')} className="-mx-4 mt-3 sm:mx-0">
      <div className="overflow-hidden rounded-xl border border-line bg-[#F4F1EC] dark:border-white/10 dark:bg-[#111144]">
        <ul className="grid grid-cols-4 divide-x divide-x-reverse divide-line dark:divide-white/10">
          {CATEGORIES.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  prefetch
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-11 items-center justify-center px-1.5 py-2.5 text-center text-[11px] font-extrabold leading-tight transition sm:px-3 sm:text-sm sm:whitespace-nowrap ${
                    active ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  <span className="sm:hidden">{t(item.short)}</span>
                  <span className="hidden sm:inline">{t(item.label)}</span>
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-3 bottom-0 h-[2px] rounded-full transition-opacity ${
                      active ? 'bg-[#F98513]' : 'bg-transparent'
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
