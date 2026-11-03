'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LOCKUP, logoSvgDocument } from '@studio/design';
import { NAV_ITEMS, type NavItem } from '@/lib/nav';
import { CAR_BODY_TYPES, PART_CATEGORY_LINKS } from '@/lib/browse';
import { CitySelect } from './CitySelect';
import { Icon } from './Icon';
import { ThemeToggle } from './ThemeToggle';
import { useActivePath } from './useActivePath';

/**
 * App header (C8).
 *
 * Start edge (right in RTL): hamburger, theme toggle and the account action,
 * grouped together. End edge: the full «A ALI SALES» lockup as the home link.
 * The city lives in the sub-bar's `CitySelect`, not in this row.
 *
 * The header itself is opaque (no `backdrop-filter`): a filtered ancestor would
 * become the containing block for the pinned drawer and clip it to the header's
 * own box. The drawer therefore renders as a sibling of `<header>`, so its
 * `fixed inset-0` always resolves against the viewport.
 */
const DESTINATIONS: readonly NavItem[] = NAV_ITEMS.filter((item) => !item.primary);
const POST_ITEM = NAV_ITEMS.find((item) => item.primary);

const ACCOUNT_LINKS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/profile/listings', label: 'آگهی‌های من' },
  { href: '/favorites', label: 'علاقه‌مندی‌ها' },
  { href: '/chats', label: 'پیام‌ها' },
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
        aria-controls={`drawer-group-${id}`}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-extrabold text-ink"
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-muted">
          {open ? '▴' : '▾'}
        </span>
      </button>
      {open && (
        <ul id={`drawer-group-${id}`} className="grid gap-1 border-t border-line p-2">
          {children}
        </ul>
      )}
    </div>
  );
}

export function Header({
  authed = false,
  displayName = null,
  admin = false,
}: {
  authed?: boolean;
  displayName?: string | null;
  /** Owner moderation link — resolved on the server from ADMIN_PHONES. */
  admin?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<GroupKey | null>(null);
  const pathname = usePathname();
  const isActive = useActivePath();

  useEffect(() => {
    setMenuOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  // Escape closes the drawer, and the page behind it must not scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const toggleGroup = (group: GroupKey) =>
    setOpenGroup((current) => (current === group ? null : group));

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-card">
        <div className="mx-auto flex h-16 w-full max-w-[var(--content-max)] items-center gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
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
              <Link href="/login" className="btn-ghost whitespace-nowrap px-3 py-1.5 text-sm">
                ورود
              </Link>
            )}
          </div>

          <div className="ms-auto flex min-w-0 items-center gap-2">
            {/* The lockup ships fixed 460×180 attributes; this box clips it to
                the 36px header mark so a stylesheet hiccup can never let the
                mark spill over the buttons on a narrow phone. */}
            <Link
              href="/"
              aria-label="Ali Sales — صفحه اصلی"
              className="flex h-9 min-w-0 max-w-[46vw] shrink items-center overflow-hidden sm:max-w-none [&>svg]:h-9 [&>svg]:w-auto"
              dangerouslySetInnerHTML={{ __html: logoSvgDocument(LOCKUP, 'Ali Sales') }}
            />
          </div>
        </div>

        {/* Tablet/desktop: destinations on the start edge, city + CTA on the end edge. */}
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
            <li className="ms-auto flex items-center gap-2">
              <CitySelect />
              {POST_ITEM && (
                <Link href={POST_ITEM.href} className="btn-cta text-sm">
                  <Icon name="plus" size={18} />
                  {POST_ITEM.label}
                </Link>
              )}
            </li>
          </ul>
        </nav>
      </header>

      {menuOpen && (
        <div id="site-menu" className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="بستن منو"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-[#111144]/45"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="منوی اصلی"
            className="absolute inset-y-0 start-0 flex w-80 max-w-[85vw] flex-col border-e border-line bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="text-sm font-extrabold text-ink">منو</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="بستن منو"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition hover:border-line-strong"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
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
                        href={`/cars?body=${type.key}`}
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
                        href={`/parts?category=${category.key}`}
                        className="block rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                      >
                        {category.label}
                      </Link>
                    </li>
                  ))}
                </MenuGroup>
              </div>

              <div className="my-4 border-t border-line" />

              <h2 className="mb-2 text-xs font-extrabold text-faint">حساب کاربری</h2>
              <ul className="grid gap-1">
                <li>
                  <Link
                    href={authed ? '/profile' : '/login'}
                    className="block rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                  >
                    {authed ? 'پروفایل' : 'ورود'}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/new"
                    className="block rounded-field px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
                  >
                    ثبت آگهی
                  </Link>
                </li>
                {admin && (
                  <li>
                    <Link
                      href="/admin"
                      aria-current={pathname === '/admin' ? 'page' : undefined}
                      className="flex items-center gap-1.5 rounded-field px-2 py-1.5 text-sm font-bold text-cta transition hover:bg-cta-soft"
                    >
                      <Icon name="gear" size={14} />
                      پنل مدیریت
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
            </div>

            <div className="border-t border-line p-4">
              <CitySelect className="w-full [&>button]:w-full [&>button]:justify-between" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
