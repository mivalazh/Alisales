'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { BrandLockup } from './BrandLockup';

/**
 * Site footer — the home of everything that is information rather than action.
 *
 * Desktop is a balanced four-column grid, right to left: the brand mark with a
 * one-line tagline, «دسترسی سریع», «راهنما و قوانین», then «پشتیبانی» with the
 * official eNamad trust seal under it. On phones the three link columns become
 * an accordion (`<details>`), because three stacked sections pushed the
 * copyright a full screen down and made a browse page feel like it never ended.
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
 * The official eNamad snippet, byte for byte.
 *
 * eNamad's verifier reads the `code` attribute on the seal image, which React
 * does not know and would drop if the anchor were written as JSX. The markup is
 * therefore injected untouched into a clean wrapper, so the seal keeps working
 * exactly as issued. Never rewrite, re-quote or "clean up" this string.
 */
const ENAMAD_HTML =
  "<a referrerpolicy='origin' target='_blank' href='https://trustseal.enamad.ir/?id=8743744&Code=7VHPkq3VWifTz2YgUPSKJVbz1XwaJ4iU'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=8743744&Code=7VHPkq3VWifTz2YgUPSKJVbz1XwaJ4iU' alt='' style='cursor:pointer' code='7VHPkq3VWifTz2YgUPSKJVbz1XwaJ4iU'></a>";

function EnamadSeal({ id = 'enamad-seal-slot' }: { id?: string }) {
  return (
    <div
      id={id}
      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-xs"
      dangerouslySetInnerHTML={{ __html: ENAMAD_HTML }}
    />
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
        <div className="md:hidden">
          <BrandLockup size="lg" wordmark={false} />
          <p className="mt-2 text-xs leading-6 text-muted">
            {t('بازار خودرو در کیش', 'Kish’s vehicle marketplace')}
          </p>
          <div className="mt-3">
            <FooterAccordion />
          </div>
          <div className="mt-4 flex justify-center">
            <EnamadSeal id="enamad-seal-slot-mobile" />
          </div>
        </div>

        {/* Desktop: a balanced four-column grid, right to left. */}
        <div className="hidden grid-cols-1 gap-8 md:grid md:grid-cols-4 md:items-start">
          <div className="flex flex-col items-start gap-2">
            <BrandLockup size="lg" wordmark={false} />
            <p className="text-xs font-semibold leading-6 text-muted">
              {t('بازار خودرو در کیش', 'Kish’s vehicle marketplace')}
            </p>
          </div>
          <FooterColumn
            title={t(SECTIONS[0].title, SECTIONS[0].en)}
            links={SECTIONS[0].links}
          />
          <FooterColumn
            title={t(SECTIONS[1].title, SECTIONS[1].en)}
            links={SECTIONS[1].links}
          />
          <div className="flex flex-col items-start gap-4">
            <FooterColumn
              title={t(SECTIONS[2].title, SECTIONS[2].en)}
              links={SECTIONS[2].links}
            />
            <EnamadSeal />
          </div>
        </div>

        {/* The floating assistant orb is pinned to the bottom-right of the
            viewport, so the bar reserves one inset on that physical edge. A
            physical `pr` (not a logical `ps`/`pe`) is deliberate: the orb is
            positioned with `right-*`, so the gap must stay on the right in
            RTL and in English mode alike. That single inset clears both the
            copyright text (RTL) and the Miva Tech badge (LTR) without padding
            a second, empty side. */}
        <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-line pt-4 pb-8 md:pr-20 sm:flex-row sm:items-center">
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
