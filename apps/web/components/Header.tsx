'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { LOCKUP, logoSvgDocument, type IconName } from '@studio/design';
import { useI18n } from '@/lib/i18n';
import { NAV_ITEMS, type NavItem } from '@/lib/nav';
import { CitySelect } from './CitySelect';
import { Icon } from './Icon';
import { LogoutButton } from './LogoutButton';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { useActivePath } from './useActivePath';

/**
 * App header + the standard drawer.
 *
 * Start edge (right in RTL): hamburger, theme toggle and the account action,
 * grouped together. End edge: the full «A ALI SALES» lockup as the home link.
 * The city lives in the sub-bar's `CitySelect`, not in this row.
 *
 * There is no rental pill in the header any more: the rental portal has its
 * own bridge inside the drawer, so the lockup keeps its full size on a phone.
 *
 * The drawer follows one exact order (my ads → categories → city → support →
 * about → spacer → rental portal → language circle → logout). Saved ads and the
 * theme switch were duplicates of the bottom bar/header and were removed.
 */
const DESTINATIONS: readonly NavItem[] = NAV_ITEMS.filter((item) => !item.primary);
const POST_ITEM = NAV_ITEMS.find((item) => item.primary);

const EN_NAV: Record<string, string> = {
  home: 'Home',
  chats: 'Chats',
  post: 'Post ad',
  favorites: 'Saved',
  profile: 'Profile',
};

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

function DrawerSection({ children }: { children: ReactNode }) {
  return <ul className="space-y-0.5">{children}</ul>;
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
  const { lang, t, toggleLanguage } = useI18n();
  const [rentalSoon, setRentalSoon] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) setRentalSoon(false);
  }, [menuOpen]);

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
              aria-label={menuOpen ? t('بستن منو', 'Close menu') : t('باز کردن منو', 'Open menu')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-line-strong"
            >
              <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
            </button>
            <ThemeToggle />
            <NotificationBell authed={authed} />
            {authed ? (
              <>
                <Link
                  href="/profile"
                  className="hidden max-w-40 truncate rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-xs font-bold text-ink md:inline-flex"
                >
                  {displayName ?? t('پروفایل', 'Profile')}
                </Link>
              </>
            ) : (
              <Link href="/login" className="btn-ghost whitespace-nowrap px-3 py-1.5 text-sm">
                {t('ورود', 'Sign in')}
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
              className="flex h-9 shrink-0 items-center overflow-hidden [&>svg]:h-9 [&>svg]:w-auto"
              dangerouslySetInnerHTML={{ __html: logoSvgDocument(LOCKUP, 'Ali Sales') }}
            />
          </div>
        </div>

        {/* Tablet/desktop: destinations on the start edge, city + CTA on the end edge. */}
        <nav aria-label={t('ناوبری اصلی', 'Main navigation')} className="hidden border-t border-line md:block">
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
                    {t(item.label, EN_NAV[item.key] ?? item.label)}
                  </Link>
                </li>
              );
            })}
            <li className="ms-auto flex items-center gap-2">
              <CitySelect />
              {POST_ITEM && (
                <Link href={POST_ITEM.href} className="btn-cta text-sm">
                  <Icon name="plus" size={18} />
                  {t(POST_ITEM.label, 'Post ad')}
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
            aria-label={t('بستن منو', 'Close menu')}
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-[#111144]/45"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('منوی اصلی', 'Main menu')}
            className="absolute inset-y-0 start-0 flex w-80 max-w-[85vw] flex-col border-e border-line bg-card shadow-2xl"
          >
            {/* No «منو» title — just the close control, as the reference asks. */}
            <div className="flex items-center justify-end border-b border-line px-4 py-2">
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t('بستن منو', 'Close menu')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition hover:border-line-strong"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto p-3">
              <DrawerSection>
                <DrawerLink
                  href="/profile/listings"
                  label={t('آگهی‌های من', 'My ads')}
                  icon="tag"
                  active={pathname === '/profile/listings'}
                />
              </DrawerSection>

              <div className="mt-3">
                <DrawerSection>
                  <DrawerAccordion
                    href="/cars"
                    label={t('خودرو', 'Cars')}
                    icon="car"
                    active={pathname === '/cars'}
                    allLabel={t('همه خودروها', 'All cars')}
                    links={[
                      { href: '/cars?bodyType=suv', label: t('شاسی‌بلند (SUV)', 'SUV') },
                      { href: '/cars?bodyType=sedan', label: t('سدان (سواری)', 'Sedan') },
                      { href: '/cars?bodyType=coupe', label: t('کوپه و اسپرت', 'Coupe & sport') },
                      { href: '/cars?plateType=kish', label: t('پلاک منطقه آزاد', 'Free-zone plate') },
                      {
                        href: '/cars?plateType=temporary_transit',
                        label: t('گذر موقت', 'Temporary transit'),
                      },
                    ]}
                  />
                  <DrawerAccordion
                    href="/motorcycles"
                    label={t('موتور و اسکوتر برقی', 'Electric bikes & scooters')}
                    icon="plate"
                    active={pathname === '/motorcycles'}
                    allLabel={t('همه موتورها', 'All bikes')}
                    links={[
                      { href: '/motorcycles?bikeType=scooter', label: t('اسکوتر برقی', 'Electric scooter') },
                      { href: '/motorcycles?bikeType=electric', label: t('موتور برقی', 'Electric bike') },
                      { href: '/motorcycles?bikeType=sport', label: t('موتور اسپرت / ریس', 'Sport bike') },
                      { href: '/motorcycles?bikeType=cross', label: t('کراس و آفرود', 'Cross & off-road') },
                      { href: '/motorcycles?bikeType=classic', label: t('کلاسیک', 'Classic') },
                    ]}
                  />
                  <DrawerAccordion
                    href="/heavy"
                    label={t('ماشین‌آلات سنگین', 'Heavy machinery')}
                    icon="gear"
                    active={pathname === '/heavy'}
                    allLabel={t('همه ماشین‌آلات', 'All machinery')}
                    links={[
                      { href: '/heavy?heavyType=truck', label: t('کامیون', 'Truck') },
                      { href: '/heavy?heavyType=tractor', label: t('کشنده', 'Tractor unit') },
                      { href: '/heavy?heavyType=excavator', label: t('بیل مکانیکی', 'Excavator') },
                      { href: '/heavy?heavyType=loader', label: t('لودر', 'Loader') },
                      { href: '/heavy?heavyType=crane', label: t('جرثقیل', 'Crane') },
                    ]}
                  />
                  <DrawerAccordion
                    href="/parts"
                    label={t('قطعات و لوازم یدکی', 'Spare parts')}
                    icon="tag"
                    active={pathname === '/parts'}
                    allLabel={t('همه قطعات', 'All parts')}
                    links={[
                      { href: '/parts?category=engine_battery', label: t('موتور و باتری', 'Engine & battery') },
                      { href: '/parts?category=brake', label: t('ترمز و تعلیق', 'Brakes & suspension') },
                      { href: '/parts?category=body', label: t('بدنه و چراغ', 'Body & lights') },
                      { href: '/parts?category=engine', label: t('گیربکس و کلاچ', 'Gearbox & clutch') },
                    ]}
                  />
                </DrawerSection>
              </div>

              <ul className="space-y-0.5">
                <li className="px-1 py-1">
                  <div className="flex items-center gap-2 rounded-field border border-line bg-page px-3 py-2">
                    <Icon name="pin" size={18} className="shrink-0 text-cta" />
                    <span className="flex-1 text-sm font-semibold text-muted">
                      {t('شهر', 'City')}
                    </span>
                    <CitySelect />
                  </div>
                </li>
              </ul>

              <div className="mt-3">
                <DrawerSection>
                  <DrawerLink
                    href="/support"
                    label={t('پشتیبانی و سوالات متداول', 'Support & FAQ')}
                    icon="message"
                    active={pathname === '/support'}
                  />
                  <DrawerLink
                    href="/about"
                    label={t('درباره ما', 'About us')}
                    icon="sparkle"
                    active={pathname === '/about'}
                  />
                </DrawerSection>
              </div>

              <div className="my-5 flex-1" />

              <div className="space-y-3 border-t border-line pt-3">
                <button
                  type="button"
                  aria-label={t(
                    'پورتال رنت — به‌زودی',
                    'Rental portal — coming soon',
                  )}
                  onClick={() => setRentalSoon(true)}
                  className="flex w-full items-center justify-center rounded-xl border border-[#c5dc1e] bg-[#DEF434] px-4 py-3 text-center text-sm font-extrabold text-[#111144] transition hover:bg-[#d4eb28] active:scale-[0.98]"
                >
                  <span aria-live="polite">
                    {rentalSoon
                      ? t('به‌زودی', 'Coming soon')
                      : t('پورتال رنت (به‌زودی)', 'Rental portal (coming soon)')}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    aria-label={lang === 'fa' ? 'Switch to English' : 'تغییر به زبان فارسی'}
                    title={lang === 'fa' ? 'English' : 'فارسی'}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-page text-[11px] font-extrabold tracking-wide text-ink transition hover:border-cta hover:text-cta"
                  >
                    {lang === 'fa' ? 'EN' : 'FA'}
                  </button>
                  {authed ? (
                    <div className="min-w-0 flex-1">
                      <LogoutButton />
                    </div>
                  ) : (
                    <Link href="/login" className="btn-cta flex min-w-0 flex-1 text-sm">
                      {t('ورود به حساب', 'Sign in')}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
