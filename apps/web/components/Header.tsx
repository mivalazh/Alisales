'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LOGO, logoSvgDocument } from '@studio/design';
import { BRANDS, CITY_LABELS, DEFAULT_CITY } from '@alisales/schemas';
import { NAV_ITEMS } from '@/lib/nav';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';

/**
 * App header (C8). From the start edge (right in RTL): hamburger, theme
 * toggle, centered «Ali Sales» logo, then the city word «کیش» and the account
 * action — «ورود» for guests, the display name for a signed-in account.
 * No notification bell anywhere.
 *
 * Tablet/desktop also get the five destinations as a top nav; phone width
 * uses the bottom bar.
 */
export function Header({
  authed = false,
  displayName = null,
}: {
  authed?: boolean;
  displayName?: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
      <div className="relative mx-auto flex h-16 w-full max-w-[var(--content-max)] items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-line-strong"
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
          </button>
          <ThemeToggle />
        </div>

        <Link
          href="/"
          aria-label="Ali Sales — صفحه اصلی"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 [&>svg]:h-8 [&>svg]:w-auto"
          dangerouslySetInnerHTML={{ __html: logoSvgDocument(LOGO.primary, 'Ali Sales') }}
        />

        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-ink">{CITY_LABELS[DEFAULT_CITY]}</span>
          {authed ? (
            <Link
              href="/profile"
              className="max-w-24 truncate rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-xs font-bold text-ink sm:max-w-none"
            >
              {displayName ?? 'پروفایل'}
            </Link>
          ) : (
            <Link href="/login" className="btn-ghost px-3 py-1.5 text-sm">
              ورود
            </Link>
          )}
        </div>
      </div>

      {/* Tablet/desktop destinations — phone width uses the bottom bar. */}
      <nav aria-label="ناوبری اصلی" className="hidden border-t border-line sm:block">
        <ul className="mx-auto flex w-full max-w-[var(--content-max)] items-center gap-1 px-6 py-1.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            if (item.primary) {
              return (
                <li key={item.key} className="ms-auto">
                  <Link href={item.href} className="btn-cta text-sm">
                    <Icon name={item.icon} size={18} />
                    {item.label}
                  </Link>
                </li>
              );
            }
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-[var(--radius-pill)] px-3 py-2 text-sm font-semibold transition ${
                    active ? 'bg-cta-soft text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

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
                    href={authed ? '/profile' : '/login'}
                    className="flex items-center gap-2 rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                  >
                    <Icon name="user" size={18} />
                    {authed ? 'پروفایل' : 'ورود'}
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
