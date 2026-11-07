'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { LOCKUP, logoSvgDocument, type IconName } from '@studio/design';
import { NAV_ITEMS, type NavItem } from '@/lib/nav';
import { CitySelect } from './CitySelect';
import { Icon } from './Icon';
import { LogoutButton } from './LogoutButton';
import { ThemeToggle } from './ThemeToggle';
import { useActivePath } from './useActivePath';

/**
 * App header (C8) + the standard drawer.
 *
 * Start edge (right in RTL): hamburger, theme toggle and the account action,
 * grouped together. End edge: the full «A ALI SALES» lockup as the home link.
 * The city lives in the sub-bar's `CitySelect`, not in this row.
 *
 * The drawer is the product menu, not a copy of the bottom bar: it carries the
 * actions that have no tab (post a listing, my listings, saved listings), the
 * viewer's preferences (city, price unit, theme) and the information pages,
 * each row with one icon, one label and a chevron, in headed sections. Home,
 * chats and profile stay in the navigation bars only.
 *
 * The header itself is opaque (no `backdrop-filter`): a filtered ancestor would
 * become the containing block for the pinned drawer and clip it to the header's
 * own box. The drawer therefore renders as a sibling of `<header>`, so its
 * `fixed inset-0` always resolves against the viewport.
 */
const DESTINATIONS: readonly NavItem[] = NAV_ITEMS.filter((item) => !item.primary);
const POST_ITEM = NAV_ITEMS.find((item) => item.primary);

function DrawerLink({
  href,
  label,
  icon,
  hint,
  active = false,
}: {
  href: string;
  label: string;
  icon: IconName;
  hint?: string;
  active?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 rounded-field px-3 py-2.5 text-sm transition hover:bg-cta-soft ${
          active ? 'font-extrabold text-ink' : 'font-semibold text-muted hover:text-ink'
        }`}
      >
        <Icon name={icon} size={18} className="shrink-0 text-cta" />
        <span className="flex-1">{label}</span>
        {hint && <span className="text-[11px] font-bold text-faint">{hint}</span>}
        <Icon name="chevronLeft" size={14} className="shrink-0 text-faint" />
      </Link>
    </li>
  );
}

/** One expandable drawer category with quick sub-category links. */
function DrawerAccordion({
  href,
  label,
  icon,
  active,
  allLabel,
  links,
}: {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
  allLabel: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <li>
      <details className="group">
        <summary
          className={`flex cursor-pointer list-none items-center gap-3 rounded-field px-3 py-2.5 text-sm transition hover:bg-cta-soft ${
            active ? 'font-extrabold text-ink' : 'font-semibold text-muted hover:text-ink'
          }`}
        >
          <Icon name={icon} size={18} className="shrink-0 text-cta" />
          <span className="flex-1">{label}</span>
          <Icon
            name="chevronDown"
            size={14}
            className="shrink-0 text-faint transition group-open:rotate-180"
          />
        </summary>
        <ul className="mb-1 ms-4 border-s border-line ps-2">
          <li>
            <Link
              href={href}
              className="flex items-center justify-between rounded-field px-2 py-1.5 text-xs font-bold text-muted transition hover:bg-cta-soft hover:text-ink"
            >
              {allLabel}
              <Icon name="chevronLeft" size={12} className="text-faint" />
            </Link>
          </li>
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center justify-between rounded-field px-2 py-1.5 text-xs font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
              >
                {link.label}
                <Icon name="chevronLeft" size={12} className="text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3 first:mt-0">
      <h2 className="px-3 pb-1 text-[11px] font-extrabold uppercase tracking-wide text-faint">
        {title}
      </h2>
      <ul className="space-y-0.5">{children}</ul>
    </section>
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
  const pathname = usePathname();
  const isActive = useActivePath();
  const rentMode = Boolean(pathname?.startsWith('/rent'));

  useEffect(() => {
    setMenuOpen(false);
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
              <>
                <Link
                  href="/profile"
                  aria-label={displayName ?? 'پروفایل'}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-line-strong sm:hidden"
                >
                  <Icon name="user" size={19} />
                </Link>
                <Link
                  href="/profile"
                  className="hidden max-w-40 truncate rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-xs font-bold text-ink sm:block"
                >
                  {displayName ?? 'پروفایل'}
                </Link>
              </>
            ) : (
              <Link href="/login" className="btn-ghost whitespace-nowrap px-3 py-1.5 text-sm">
                ورود
              </Link>
            )}
          </div>

          <div className="ms-auto flex min-w-0 items-center gap-2">
            {/* Bridge between the classifieds and the rental sister site — one
                compact pill, never mixed feeds. */}
            <Link
              href={rentMode ? '/' : '/rent'}
              aria-label={rentMode ? 'بازگشت به خرید و فروش' : 'ورود به رنت خودرو و موتور'}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--radius-pill)] border border-[#064E3B]/25 bg-[#ECFDF5] px-2.5 py-1.5 text-[10px] font-extrabold text-[#064E3B] transition hover:border-[#064E3B]/50 sm:text-xs dark:border-[#047857]/50 dark:bg-[#064E3B]/30 dark:text-[#A7F3D0]"
            >
              <span className="sm:hidden">{rentMode ? '🚗 خرید و فروش' : '🔑 رنت'}</span>
              <span className="hidden sm:inline">
                {rentMode ? '🚗 بازگشت به خرید و فروش (Ali Sales)' : '🔑 رنت خودرو و موتور'}
              </span>
            </Link>
            {/* The lockup ships fixed 460×180 attributes; this box clips it to
                the 36px header mark so a stylesheet hiccup can never let the
                mark spill over the buttons on a narrow phone. */}
            <Link
              href="/"
              aria-label="Ali Sales — صفحه اصلی"
              className="flex h-9 shrink-0 items-center overflow-hidden [&>svg]:h-9 [&>svg]:w-auto"
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

            <div className="flex-1 overflow-y-auto p-3">
              {/* «ثبت آگهی» already lives in the desktop sub-bar and the mobile
                  bottom bar, so the drawer stays a navigation list. */}
              <DrawerSection title="آگهی‌ها">
                <DrawerLink
                  href="/profile/listings"
                  label="آگهی‌های من"
                  icon="tag"
                  active={pathname === '/profile/listings'}
                />
                <DrawerLink
                  href="/favorites"
                  label="ذخیره‌شده‌ها"
                  icon="heart"
                  active={pathname === '/favorites'}
                />
              </DrawerSection>

              <DrawerSection title="دسته‌بندی‌ها">
                <DrawerAccordion
                  href="/cars"
                  label="خودرو"
                  icon="car"
                  active={pathname === '/cars'}
                  allLabel="همه خودروها"
                  links={[
                    { href: '/cars?bodyType=suv', label: 'شاسی‌بلند (SUV)' },
                    { href: '/cars?bodyType=sedan', label: 'سدان (سواری)' },
                    { href: '/cars?bodyType=coupe', label: 'کوپه و اسپرت' },
                    { href: '/cars?plateType=kish', label: 'پلاک منطقه آزاد' },
                    { href: '/cars?plateType=temporary_transit', label: 'گذر موقت' },
                  ]}
                />
                <DrawerAccordion
                  href="/motorcycles"
                  label="موتور و اسکوتر برقی"
                  icon="plate"
                  active={pathname === '/motorcycles'}
                  allLabel="همه موتورها"
                  links={[
                    { href: '/motorcycles?bikeType=scooter', label: 'اسکوتر برقی' },
                    { href: '/motorcycles?bikeType=electric', label: 'موتور برقی' },
                    { href: '/motorcycles?bikeType=sport', label: 'موتور اسپرت / ریس' },
                    { href: '/motorcycles?bikeType=cross', label: 'کراس و آفرود' },
                    { href: '/motorcycles?bikeType=classic', label: 'کلاسیک' },
                  ]}
                />
                <DrawerAccordion
                  href="/heavy"
                  label="ماشین‌آلات سنگین"
                  icon="gear"
                  active={pathname === '/heavy'}
                  allLabel="همه ماشین‌آلات"
                  links={[
                    { href: '/heavy?heavyType=truck', label: 'کامیون' },
                    { href: '/heavy?heavyType=tractor', label: 'کشنده' },
                    { href: '/heavy?heavyType=excavator', label: 'بیل مکانیکی' },
                    { href: '/heavy?heavyType=loader', label: 'لودر' },
                    { href: '/heavy?heavyType=crane', label: 'جرثقیل' },
                  ]}
                />
                <DrawerAccordion
                  href="/parts"
                  label="قطعات"
                  icon="tag"
                  active={pathname === '/parts'}
                  allLabel="همه قطعات"
                  links={[
                    { href: '/parts?category=engine_battery', label: 'موتور و باتری' },
                    { href: '/parts?category=brake', label: 'ترمز و تعلیق' },
                    { href: '/parts?category=body', label: 'بدنه و چراغ' },
                    { href: '/parts?category=engine', label: 'گیربکس و کلاچ' },
                  ]}
                />
              </DrawerSection>

              {/* Display lives here as two plain rows. Price unit, legal text and
                  the owner's moderation tools deliberately do not: they belong
                  to the header, the footer and /profile respectively. */}
              <DrawerSection title="نمایش">
                <li className="px-1 py-1">
                  <div className="flex items-center gap-2 rounded-field border border-line bg-page px-3 py-2">
                    <Icon name="pin" size={18} className="shrink-0 text-cta" />
                    <span className="flex-1 text-sm font-semibold text-muted">شهر</span>
                    <CitySelect />
                  </div>
                </li>
                <li className="flex items-center gap-3 px-3 py-2">
                  <Icon name="moon" size={18} className="shrink-0 text-cta" />
                  <span className="flex-1 text-sm font-semibold text-muted">تم روشن / تیره</span>
                  <ThemeToggle />
                </li>
              </DrawerSection>

              <DrawerSection title="اطلاعات">
                <DrawerLink
                  href="/support"
                  label="پشتیبانی و سوالات متداول"
                  icon="message"
                  active={pathname === '/support'}
                />
                <DrawerLink
                  href="/about"
                  label="درباره ما"
                  icon="sparkle"
                  active={pathname === '/about'}
                />
              </DrawerSection>

              <div className="mt-4 border-t border-line pt-3">
                {authed ? (
                  <LogoutButton />
                ) : (
                  <Link href="/login" className="btn-cta w-full text-sm">
                    ورود به حساب
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
