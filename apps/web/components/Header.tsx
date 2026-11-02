'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LOCKUP, logoSvgDocument } from '@studio/design';
import { CITY_LABELS, DEFAULT_CITY } from '@alisales/schemas';
import { NAV_ITEMS, type NavItem } from '@/lib/nav';
import { CAR_BODY_TYPES, PART_CATEGORY_LINKS } from '@/lib/browse';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';
import { useActivePath } from './useActivePath';

/**
 * App header (C8). Start edge (right in RTL): hamburger, theme toggle and the
 * account action, grouped together. End edge: the full «A ALI SALES» lockup as
 * the home link, pushed to the far edge so nothing sits in the middle between
 * the buttons and the mark.
 *
 * On tablet/desktop the destinations (خانه، چت‌ها، علاقه‌مندی‌ها، پروفایل) sit
 * together on the start edge and «+ ثبت آگهی» is pushed to the end edge, never
 * mixed into the middle of that list. The drawer carries the two category
 * accordions, the account links and the two support actions.
 */
const DESTINATIONS: readonly NavItem[] = NAV_ITEMS.filter((item) => !item.primary);
const POST_ITEM = NAV_ITEMS.find((item) => item.primary);

const ACCOUNT_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/profile/listings', label: 'آگهی‌های من' },
  { href: '/favorites', label: 'علاقه‌مندی‌ها' },
  { href: '/chats', label: 'پیام‌ها' },
  { href: '/guide', label: 'راهنمای ثبت آگهی' },
  { href: '/terms', label: 'قوانین و حریم خصوصی' },
  { href: '/about', label: 'درباره‌ی ما' },
];

const SUPPORT_LINKS = [
  {
    href: '/support/brand-request',
    label: 'درخواست افزودن خودرو یا برند جدید',
    icon: 'plus' as const,
  },
  {
    href: '/support/ticket',
    label: 'پشتیبانی و ثبت تیکت',
    icon: 'message' as const,
  },
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
  const isActive = useActivePath();

  useEffect(() => {
    setMenuOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  const toggleGroup = (group: GroupKey) =>
    setOpenGroup((current) => (current === group ? null : group));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[var(--content-max)] items-center gap-2 px-4 sm:px-6">
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

        <div className="ms-auto flex min-w-0 items-center gap-2">
          <span className="hidden text-sm font-extrabold text-ink sm:inline">
            {CITY_LABELS[DEFAULT_CITY]}
          </span>
          <Link
            href="/"
            aria-label="Ali Sales — صفحه اصلی"
            className="flex min-w-0 shrink-0 items-center [&>svg]:h-9 [&>svg]:w-auto"
            dangerouslySetInnerHTML={{ __html: logoSvgDocument(LOCKUP, 'Ali Sales') }}
          />
        </div>
      </div>

      {/* Tablet/desktop: destinations on the start edge, CTA on the end edge. */}
      <nav aria-label="ناوبری اصلی" className="hidden border-t border-line md:block">
        <ul className="mx-auto flex w-full max-w-[var(--content-max)] items-center gap-1 px-6 py-1.5">
          {DESTINATIONS.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-[var(--radius-pill)] px-3 py-2 text-sm font-semibold transition ${
                    active ? 'bg-cta-soft text-ink font-extrabold' : 'text-muted hover:text-ink'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
          {POST_ITEM && (
            <li className="ms-auto">
              <Link href={POST_ITEM.href} className="btn-cta text-sm">
                <Icon name="plus" size={18} />
                {POST_ITEM.label}
              </Link>
            </li>
          )}
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

            <h2 className="mb-2 text-xs font-extrabold text-faint">حساب</h2>
            <ul className="grid gap-1 sm:grid-cols-2">
              <li>
                <Link
                  href={authed ? '/profile' : '/login'}
                  className="block rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                >
                  {authed ? 'پروفایل' : 'ورود'}
                </Link>
              </li>
              {authed && (
                <li>
                  <Link
                    href="/new"
                    className="block rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                  >
                    ثبت آگهی
                  </Link>
                </li>
              )}
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

            <div className="my-4 border-t border-line" />

            <h2 className="mb-2 text-xs font-extrabold text-faint">درخواست و پشتیبانی</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {SUPPORT_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 rounded-field border border-line bg-page px-3 py-2.5 text-sm font-extrabold text-ink transition hover:border-line-strong hover:bg-cta-soft"
                  >
                    <Icon name={item.icon} size={18} className="text-cta" />
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
