'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

/**
 * Site footer — the home of everything that is information rather than action.
 *
 * Desktop keeps the four-column layout. On phones the link columns become an
 * accordion (`<details>`), because three stacked sections pushed the copyright
 * a full screen down and made a browse page feel like it never ended.
 *
 * The city selector was removed: it already lives in the header sub-bar, so a
 * second «کیش ▾» control in the footer only duplicated the same state.
 */
// «ثبت آگهی» is already in the header and bottom bar — not repeated here.
const QUICK_LINKS = [
  { href: '/cars', label: 'خودروها', en: 'Cars' },
  { href: '/motorcycles', label: 'موتور و اسکوتر برقی', en: 'Bikes & scooters' },
  { href: '/parts', label: 'قطعات و لوازم یدکی', en: 'Spare parts' },
] as const;

const GUIDE_LINKS = [
  { href: '/about', label: 'درباره‌ی ما', en: 'About us' },
  { href: '/inspection', label: 'کارشناسی تعمیرگاه شمس‌اله', en: 'Shamsollah workshop inspection' },
  { href: '/guide', label: 'راهنمای ثبت آگهی', en: 'Posting guide' },
  { href: '/terms', label: 'قوانین و حریم خصوصی', en: 'Terms & privacy' },
] as const;

/** Official sub-brand credit — one line, repeated in the footer and /about. */
export const WORKSHOP_CREDIT =
  'Ali Sales؛ زیرمجموعه رسمی تعمیرگاه تخصصی شمس‌اله — مرجع خرید، فروش و کارشناسی تخصصی خودرو در کیش';

export const WORKSHOP_CREDIT_EN =
  'Ali Sales — the official subsidiary of Shamsollah Specialist Workshop, Kish’s reference for vehicle sales and inspection.';

const SUPPORT_LINKS = [
  { href: '/support', label: 'تماس با پشتیبانی', en: 'Contact support' },
  { href: '/support/brand-request', label: 'پیشنهادات شما برای بهتر کردن سایت', en: 'Suggestions to improve the site' },
  { href: '/support/ticket', label: 'ثبت تیکت پشتیبانی', en: 'Open a support ticket' },
] as const;

const SECTIONS = [
  { title: 'دسترسی سریع', en: 'Quick links', links: QUICK_LINKS },
  { title: 'راهنما و قوانین', en: 'Guides & legal', links: GUIDE_LINKS },
  { title: 'پشتیبانی', en: 'Support', links: SUPPORT_LINKS },
] as const;

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string; en: string }>;
}) {
  const { t } = useI18n();
  return (
    <div>
      <h2 className="text-sm font-extrabold text-ink">{title}</h2>
      <ul className="mt-2 space-y-1.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm font-semibold text-muted transition hover:text-ink"
            >
              {t(link.label, link.en)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Phone footer: three collapsed rows instead of one long column list. */
function FooterAccordion() {
  const { t } = useI18n();
  return (
    <div className="divide-y divide-line rounded-card border border-line bg-page">
      {SECTIONS.map((section) => (
        <details key={section.title} className="group px-3 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-extrabold text-ink [&::-webkit-details-marker]:hidden">
            {t(section.title, section.en)}
            <span aria-hidden className="text-faint transition group-open:rotate-180">
              ⌄
            </span>
          </summary>
          <ul className="mt-2 space-y-1.5 pb-1">
            {section.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="block text-sm font-semibold text-muted transition hover:text-ink"
                >
                  {t(link.label, link.en)}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="site-footer mt-12 border-t border-line bg-card pb-20 sm:pb-0">
      <div className="mx-auto w-full max-w-[var(--content-max)] px-4 py-8 sm:px-6 sm:py-10">
        {/* Phone: compact identity + accordion */}
        <div className="sm:hidden">
          <p className="text-base font-extrabold text-ink">Ali Sales</p>
          <p className="mt-2 rounded-field border border-[#F98513]/40 bg-[#FFF7EC] px-3 py-2 text-[11px] font-bold leading-6 text-ink dark:bg-[#2a2418]">
            {t(WORKSHOP_CREDIT, WORKSHOP_CREDIT_EN)}
          </p>
          <div className="mt-3">
            <FooterAccordion />
          </div>
        </div>

        {/* Tablet and up: the full four-column layout */}
        <div className="hidden gap-8 sm:grid lg:grid-cols-4">
          <div className="lg:col-span-1">
            <p className="text-base font-extrabold text-ink">Ali Sales</p>
            <p className="mt-3 max-w-xs rounded-field border border-[#F98513]/40 bg-[#FFF7EC] px-3 py-2 text-[11px] font-bold leading-6 text-ink dark:bg-[#2a2418]">
              {t(WORKSHOP_CREDIT, WORKSHOP_CREDIT_EN)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:col-span-3">
            {SECTIONS.map((section) => (
              <FooterColumn
                key={section.title}
                title={t(section.title, section.en)}
                links={section.links}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 sm:mt-10 sm:flex-row">
          <p className="text-center text-xs text-faint sm:text-start">
            © {new Date().getFullYear()} Ali Sales —{' '}
            {t(
              'تمامی حقوق محفوظ است. مسئولیت اعلام وضعیت پلاک و صحت اطلاعات آگهی بر عهده فروشنده است.',
              'All rights reserved. The seller is responsible for plate status and ad accuracy.',
            )}
          </p>
          <p
            dir="ltr"
            className="shrink-0 rounded-[var(--radius-pill)] border border-line bg-page px-3 py-1 text-xs font-semibold tracking-wide text-muted"
          >
            Created by <span className="font-extrabold text-cta">Miva Tech</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
