'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { BrandLockup } from './BrandLockup';
import { Icon } from './Icon';

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
  { href: '/heavy', label: 'ماشین‌آلات سنگین', en: 'Heavy machinery' },
  { href: '/parts', label: 'قطعات و لوازم یدکی', en: 'Spare parts' },
] as const;

const GUIDE_LINKS = [
  { href: '/about', label: 'درباره‌ی ما', en: 'About us' },
  { href: '/guide', label: 'راهنمای ثبت آگهی', en: 'Posting guide' },
  { href: '/terms', label: 'قوانین و حریم خصوصی', en: 'Terms & privacy' },
] as const;

/** Brand credit — kept without a workshop sub-brand reference. */
export const WORKSHOP_CREDIT =
  'Ali Sales — مرجع خرید، فروش و کارشناسی خودرو در کیش';

export const WORKSHOP_CREDIT_EN =
  'Ali Sales — Kish’s reference for buying, selling and inspecting vehicles.';

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

/**
 * eNamad slot. The owner can replace the inner anchor with the official
 * verification snippet once their licence is issued; the container id and
 * dimensions stay stable so the seal never shifts the footer.
 */
function EnamadSeal({ id = 'enamad-seal-slot' }: { id?: string }) {
  const { t } = useI18n();
  return (
    <div id={id} className="shrink-0">
      <a
        href="https://www.enamad.ir/"
        target="_blank"
        referrerPolicy="origin"
        rel="noreferrer"
        aria-label={t(
          'نماد اعتماد الکترونیکی (ای‌نماد)',
          'Electronic trust seal (eNamad)',
        )}
        className="flex h-24 w-20 flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-white p-2 shadow-xs transition hover:border-slate-300 dark:border-white/10 dark:bg-[#161A38] dark:hover:border-white/20"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DEF434] text-[#111144]">
          <Icon name="shieldCheck" size={20} />
        </span>
        <span className="mt-1.5 text-center text-[8px] font-extrabold leading-3 text-[#111144] dark:text-[#F4F1EC]">
          {t('نماد اعتماد الکترونیکی (ای‌نماد)', 'eNamad trust seal')}
        </span>
      </a>
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
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 text-sm font-extrabold text-ink [&::-webkit-details-marker]:hidden">
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
                  className="flex min-h-10 items-center text-sm font-semibold text-muted transition hover:text-ink"
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
    <footer className="site-footer mt-8 border-t border-line bg-card pb-24 sm:pb-6">
      <div className="mx-auto w-full max-w-[var(--content-max)] px-4 py-7 sm:px-6">
        {/* Phone: the standalone emblem, compact accordion, then the seal. */}
        <div className="sm:hidden">
          <BrandLockup size="lg" wordmark={false} />
          <div className="mt-3">
            <FooterAccordion />
          </div>
          <div className="mt-3 flex justify-center">
            <EnamadSeal id="enamad-seal-slot-mobile" />
          </div>
        </div>

        {/* Tablet and up: four compact columns, with the seal inside the grid. */}
        <div className="hidden gap-x-6 gap-y-5 sm:grid sm:grid-cols-2 lg:grid-cols-[auto_repeat(3,minmax(0,1fr))_auto] lg:items-start">
          <div className="flex items-start">
            <BrandLockup size="lg" wordmark={false} />
          </div>
          {SECTIONS.map((section) => (
            <FooterColumn
              key={section.title}
              title={t(section.title, section.en)}
              links={section.links}
            />
          ))}
          <EnamadSeal />
        </div>

        <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
          <p className="max-w-md text-center text-xs leading-6 text-faint sm:text-start">
            © {new Date().getFullYear()} Ali Sales —{' '}
            {t(
              'تمامی حقوق محفوظ است. مسئولیت اعلام وضعیت پلاک و صحت اطلاعات آگهی بر عهده فروشنده است.',
              'All rights reserved. The seller is responsible for plate status and ad accuracy.',
            )}
          </p>
          <a
            href={process.env.NEXT_PUBLIC_CREATOR_URL || 'https://mivatech.ir'}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Created by Miva Tech — opens in a new tab"
            dir="ltr"
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border border-line bg-page px-3 py-1 text-xs font-semibold tracking-wide text-muted transition hover:border-[#F98513]/60 hover:text-ink hover:shadow-[0_0_0_3px_rgba(249,133,19,0.12)]"
          >
            <span>Created by</span>
            <span className="font-extrabold text-cta">Miva Tech</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
