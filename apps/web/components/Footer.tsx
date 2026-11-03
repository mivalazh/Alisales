import Link from 'next/link';
import { CitySelect } from './CitySelect';

/**
 * Site footer — the home of everything that is information rather than action.
 *
 * The hamburger drawer stays a navigation tool (categories + account); guides,
 * legal text and support live here, in four columns that collapse to two on
 * tablet and one on phones. The bottom bar carries the copyright on the start
 * edge and the «Created by Miva Tech» credit on the end edge, set in Latin so
 * the studio name never gets bidi-shuffled.
 */
const QUICK_LINKS = [
  { href: '/?kind=vehicle', label: 'خودروها' },
  { href: '/?kind=part', label: 'قطعات و لوازم یدکی' },
  { href: '/new', label: 'ثبت آگهی' },
] as const;

const GUIDE_LINKS = [
  { href: '/about', label: 'درباره‌ی ما' },
  { href: '/guide', label: 'راهنمای ثبت آگهی' },
  { href: '/terms', label: 'قوانین و حریم خصوصی' },
] as const;

const SUPPORT_LINKS = [
  { href: '/support', label: 'تماس با پشتیبانی' },
  { href: '/support/brand-request', label: 'درخواست افزودن خودرو یا برند جدید' },
  { href: '/support/ticket', label: 'ثبت تیکت پشتیبانی' },
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
      <ul className="mt-3 space-y-2">
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

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-line bg-card pb-20 sm:pb-0">
      <div className="mx-auto w-full max-w-[var(--content-max)] px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <p className="text-base font-extrabold text-ink">Ali Sales</p>
            <p className="mt-2 max-w-xs text-sm leading-7 text-muted">
              بازار آگهی خودروهای لوکس و قطعات یدکی در منطقه آزاد کیش؛ واردات، پلاک
              کیش و گذر موقت، با گزارش بازرسی معتبر کارگاه.
            </p>
            <div className="mt-4">
              <CitySelect />
            </div>
          </div>

          <FooterColumn title="دسترسی سریع" links={QUICK_LINKS} />
          <FooterColumn title="راهنما و قوانین" links={GUIDE_LINKS} />
          <FooterColumn title="پشتیبانی" links={SUPPORT_LINKS} />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 sm:flex-row">
          <p className="text-xs text-faint">
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
