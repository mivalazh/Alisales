'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LOGO, logoSvgDocument } from '@studio/design';
import { CITY_LABELS, DEFAULT_CITY } from '@alisales/schemas';
import { NAV_ITEMS } from '@/lib/nav';
import { CAR_BODY_TYPES, PART_CATEGORY_LINKS } from '@/lib/browse';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';

/**
 * App header (C8). From the start edge (right in RTL): hamburger, theme
 * toggle, centered «Ali Sales» logo, then the city word «کیش» and the account
 * action — «ورود» for guests, the display name for a signed-in account.
 *
 * The row is a three-column grid, so the logo keeps its own track and can
 * never sit under the buttons. The drawer carries two collapsed accordions —
 * «خودرو» and «قطعات و لوازم» — and then the account & support links.
 */
const ACCOUNT_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/new', label: 'ثبت آگهی' },
  { href: '/profile/listings', label: 'آگهی‌های من' },
  { href: '/favorites', label: 'علاقه‌مندی‌ها' },
  { href: '/chats', label: 'پیام‌ها' },
  { href: '/guide', label: 'راهنمای ثبت آگهی' },
  { href: '/terms', label: 'قوانین و حریم خصوصی' },
  { href: '/about', label: 'درباره‌ی ما' },
  { href: '/support', label: 'تماس با پشتیبانی' },
];

type GroupKey = 'cars' | 'parts';

/** One collapsible drawer group — closed until the buyer taps it. */
function MenuGroup({
  id,
  label,
  open,
  onToggle,
  children,
}: {
  id: GroupKey;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-field border border-line bg-page">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`drawer-${id}`}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-extrabold text-ink"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-muted">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <ul id={`drawer-${id}`} className="grid gap-1 border-t border-line p-2 sm:grid-cols-2">
          {children}
        </ul>
      )}
    </div>
  );
}

export function Header({
  authed = false,
  displayName = null,
}: {
  authed?: boolean;
  displayName?: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  const toggleGroup = (group: GroupKey) =>
    setOpenGroup((current) => (current === group ? null : group));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
      <div className="mx-auto grid h-16 w-full max-w-[var(--content-max)] grid-cols-[auto_1fr_auto] items-center gap-2 px-4 sm:px-6">
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

        <div className="flex min-w-0 justify-center">
          <Link
            href="/"
            aria-label="Ali Sales — صفحه اصلی"
            className="flex min-w-0 items-center justify-center [&>svg]:h-8 [&>svg]:w-auto [&>svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: logoSvgDocument(LOGO.primary, 'Ali Sales') }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm font-extrabold text-ink sm:inline">
            {CITY_LABELS[DEFAULT_CITY]}
          </span>
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
      <nav aria-label="ناوبری اصلی" className="hidden border-t border-line md:block">
        <ul className="mx-auto flex w-full max-w-[var(--content-max)] items-center gap-1 px-6 py-1.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            if (item.primary) {
              // The profile header already carries the post action.
              if (pathname === '/profile') return null;
              return (
                <li key={item.key} className="ms-auto">
                  <Link href={item.href} className="btn-cta text-sm">
                    <Icon name="plus" size={18} />
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
          <div className="mx-auto w-full max-w-[var(--content-max)] px-4 py-4 sm:px-6">
            <h2 className="mb-2 text-xs font-extrabold text-faint">دسته‌بندی‌ها</h2>
            <div className="space-y-2">
              <MenuGroup
                id="cars"
                label="خودرو"
                open={openGroup === 'cars'}
                onToggle={() => toggleGroup('cars')}
              >
                {CAR_BODY_TYPES.map((type) => (
                  <li key={type.key}>
                    <Link
                      href={`/?body=${type.key}`}
                      className="block rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                    >
                      {type.label}
                    </Link>
                  </li>
                ))}
              </MenuGroup>

              <MenuGroup
                id="parts"
                label="قطعات و لوازم"
                open={openGroup === 'parts'}
                onToggle={() => toggleGroup('parts')}
              >
                {PART_CATEGORY_LINKS.map((category) => (
                  <li key={category.key}>
                    <Link
                      href={category.href}
                      className="block rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                    >
                      {category.label}
                    </Link>
                  </li>
                ))}
              </MenuGroup>
            </div>

            <div className="my-4 border-t border-line" />

            <h2 className="mb-2 text-xs font-extrabold text-faint">حساب و پشتیبانی</h2>
            <ul className="grid gap-1 sm:grid-cols-2">
              <li>
                <Link
                  href={authed ? '/profile' : '/login'}
                  className="block rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                >
                  {authed ? 'پروفایل' : 'ورود'}
                </Link>
              </li>
              {ACCOUNT_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={pathname === item.href ? 'page' : undefined}
                    className="block rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </header>
  );
}
