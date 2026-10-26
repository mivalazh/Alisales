'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LOGO, logoSvgDocument } from '@studio/design';
import { BRANDS, CITY_LABELS, DEFAULT_CITY, featureFlags, selectableCities } from '@alisales/schemas';
import { NAV_ITEMS } from '@/lib/nav';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';

/**
 * App header on every device:
 *  - hamburger (identical content everywhere): categories + account sections
 *    and the «ثبت آگهی» entry;
 *  - the five destinations as a top bar on tablet/desktop (sm+), where the
 *    phone-width bottom bar is hidden;
 *  - theme toggle + current city.
 */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [city, setCity] = useState<string>(DEFAULT_CITY);
  const pathname = usePathname();
  const router = useRouter();
  const cities = selectableCities();

  // Close the panel on navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[var(--content-max)] items-center gap-3 px-4 sm:px-6">
        {/* RTL start edge: hamburger is the first control on every device */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-line-strong"
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
        </button>

        <Link
          href="/"
          aria-label="Alisales — صفحه اصلی"
          className="shrink-0 [&>svg]:h-9 [&>svg]:w-auto"
          dangerouslySetInnerHTML={{ __html: logoSvgDocument(LOGO.primary, 'Alisales') }}
        />

        {/* Top navigation — tablet/desktop only (phone uses the bottom bar) */}
        <nav aria-label="ناوبری اصلی" className="ms-auto hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map((item) => {
            if (item.primary) {
              return (
                <Link key={item.key} href={item.href} className="btn-cta ms-2 text-sm">
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </Link>
              );
            }
            const active = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`rounded-[var(--radius-pill)] px-3 py-2 text-sm font-semibold transition ${
                  active ? 'bg-cta-soft text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-2 sm:ms-0">
          {/* City — single chip while city_selection is off, a picker when on */}
          {featureFlags.city_selection && cities.length > 1 ? (
            <select
              aria-label="انتخاب شهر"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                router.push(`/?city=${e.target.value}`);
              }}
              className="h-11 rounded-[var(--radius-pill)] border border-line bg-card px-3 text-sm font-bold text-ink"
            >
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="hidden h-11 items-center gap-1 rounded-[var(--radius-pill)] border border-line bg-card px-3 text-sm font-bold text-ink sm:flex">
              <Icon name="car" size={16} className="text-muted" />
              {CITY_LABELS[DEFAULT_CITY]}
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>

      {/* Hamburger panel — identical content on every device */}
      {menuOpen && (
        <div className="border-t border-line bg-card">
          <div className="mx-auto grid w-full max-w-[var(--content-max)] gap-6 px-4 py-5 sm:px-6 md:grid-cols-3">
            <section>
              <h2 className="text-xs font-extrabold text-faint">دسته‌بندی‌ها</h2>
              <ul className="mt-2 space-y-1">
                {BRANDS.map((b) => (
                  <li key={b.slug}>
                    <Link
                      href={`/?brand=${b.slug}`}
                      className="block rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                    >
                      {b.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="text-xs font-extrabold text-faint">حساب و امکانات</h2>
              <ul className="mt-2 space-y-1">
                {NAV_ITEMS.filter((i) => !i.primary).map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={pathname === item.href ? 'page' : undefined}
                      className="flex items-center gap-2 rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                    >
                      <Icon name={item.icon} size={18} />
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/login"
                    className="flex items-center gap-2 rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                  >
                    <Icon name="user" size={18} />
                    ورود
                  </Link>
                </li>
              </ul>
            </section>

            <section className="flex items-start">
              <Link href="/new" className="btn-cta w-full text-sm">
                <Icon name="plus" size={18} />
                ثبت آگهی
              </Link>
            </section>
          </div>
        </div>
      )}
    </header>
  );
}
