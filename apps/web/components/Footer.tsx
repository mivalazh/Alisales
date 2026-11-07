import Link from 'next/link';
import { CitySelect } from './CitySelect';

/**
 * Site footer — the home of everything that is information rather than action.
 *
 * Desktop keeps the four-column layout. On phones the link columns become an
 * accordion (`<details>`), because three stacked sections pushed the copyright
 * a full screen down and made a browse page feel like it never ended.
 */
// «ثبت آگهی» is already in the header and bottom bar — not repeated here.
const QUICK_LINKS = [
  { href: '/cars', label: 'خودروها' },
  { href: '/motorcycles', label: 'موتور و اسکوتر برقی' },
  { href: '/parts', label: 'قطعات و لوازم یدکی' },
] as const;

const GUIDE_LINKS = [
  { href: '/about', label: 'درباره‌ی ما' },
  { href: '/inspection', label: 'کارشناسی تعمیرگاه شمس‌اله' },
  { href: '/rent', label: 'رنت خودرو و موتور' },
  { href: '/guide', label: 'راهنمای ثبت آگهی' },
  { href: '/terms', label: 'قوانین و حریم خصوصی' },
] as const;

/** Official sub-brand credit — one line, repeated in the footer and /about. */
export const WORKSHOP_CREDIT =
  'Ali Sales؛ زیرمجموعه رسمی تعمیرگاه تخصصی شمس‌اله — مرجع خرید، فروش و کارشناسی تخصصی خودرو در کیش';

const SUPPORT_LINKS = [
  { href: '/support', label: 'تماس با پشتیبانی' },
  { href: '/support/brand-request', label: 'پیشنهادات شما برای بهتر کردن سایت' },
  { href: '/support/ticket', label: 'ثبت تیکت پشتیبانی' },
] as const;

const SECTIONS = [
  { title: 'دسترسی سریع', links: QUICK_LINKS },
  { title: 'راهنما و قوانین', links: GUIDE_LINKS },
  { title: 'پشتیبانی', links: SUPPORT_LINKS },
] as const;

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
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
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Phone footer: three collapsed rows instead of one long column list. */
function FooterAccordion() {
  return (
    <div className="divide-y divide-line rounded-card border border-line bg-page">
      {SECTIONS.map((section) => (
        <details key={section.title} className="group px-3 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-extrabold text-ink [&::-webkit-details-marker]:hidden">
            {section.title}
            <span
              aria-hidden
              className="text-faint transition group-open:rotate-180"
            >
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
                  {link.label}
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
  return (
    <footer className="mt-12 border-t border-line bg-card pb-20 sm:pb-0">
      <div className="mx-auto w-full max-w-[var(--content-max)] px-4 py-8 sm:px-6 sm:py-10">
        {/* Phone: compact identity + accordion */}
        <div className="sm:hidden">
          <p className="text-base font-extrabold text-ink">Ali Sales</p>
          <p className="mt-2 text-sm leading-7 text-muted">
            بازار آگهی خودروهای لوکس و قطعات یدکی در منطقه آزاد کیش؛ واردات، پلاک کیش و گذر
            موقت، با گزارش بازرسی معتبر کارگاه.
          </p>
          <p className="mt-2 rounded-field border border-[#F98513]/40 bg-[#FFF7EC] px-3 py-2 text-[11px] font-bold leading-6 text-ink dark:bg-[#2a2418]">
            {WORKSHOP_CREDIT}
          </p>
          <div className="mt-3 flex items-center justify-between gap-2 rounded-card border border-line bg-page px-3 py-2">
            <span className="text-xs font-bold text-muted">شهر</span>
            <CitySelect />
          </div>
          <div className="mt-3">
            <FooterAccordion />
          </div>
        </div>

        {/* Tablet and up: the full four-column layout */}
        <div className="hidden gap-8 sm:grid lg:grid-cols-4">
          <div className="lg:col-span-1">
            <p className="text-base font-extrabold text-ink">Ali Sales</p>
            <p className="mt-2 max-w-xs text-sm leading-7 text-muted">
              بازار آگهی خودروهای لوکس و قطعات یدکی در منطقه آزاد کیش؛ واردات، پلاک
              کیش و گذر موقت، با گزارش بازرسی معتبر کارگاه.
            </p>
            <p className="mt-3 max-w-xs rounded-field border border-[#F98513]/40 bg-[#FFF7EC] px-3 py-2 text-[11px] font-bold leading-6 text-ink dark:bg-[#2a2418]">
              {WORKSHOP_CREDIT}
            </p>
            <div className="mt-4">
              <CitySelect />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:col-span-3">
            {SECTIONS.map((section) => (
              <FooterColumn key={section.title} title={section.title} links={section.links} />
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 sm:mt-10 sm:flex-row">
          <p className="text-center text-xs text-faint sm:text-start">
            © {new Date().getFullYear()} Ali Sales — تمامی حقوق محفوظ است. مسئولیت
            اعلام وضعیت پلاک و صحت اطلاعات آگهی بر عهده فروشنده است.
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
