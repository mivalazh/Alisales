import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { adminGate } from '@/lib/admin/guard';
import type { MonitorVitalSummary, VitalRating } from '@/lib/monitoring/events';
import { monitorSnapshot } from '@/lib/monitoring/store';

export const metadata: Metadata = {
  title: 'پایش و سلامت',
  robots: { index: false, follow: false },
};

// Reports arrive continuously; a cached page would show a stale failure count.
export const dynamic = 'force-dynamic';

/**
 * `/admin/monitoring` — the owner's answer to "is the site healthy, and where
 * is it slow?".
 *
 * It reads the same snapshot as `GET /api/monitor` and renders it in Persian,
 * with no client JavaScript: one server read, no polling, no charts to keep
 * alive after handover. Field Web Vitals are shown as p75 per metric and per
 * route (the way Core Web Vitals is judged), and repeat failures are collapsed
 * into one row with a count so a single broken component cannot bury the rest.
 */

const RATING_LABEL: Record<VitalRating, string> = {
  good: 'سالم',
  'needs-improvement': 'نیازمند بهبود',
  poor: 'کند',
};

const RATING_CLASS: Record<VitalRating, string> = {
  good: 'bg-ok-soft text-ok',
  'needs-improvement': 'bg-warn-soft text-warn',
  poor: 'bg-bad-soft text-bad',
};

const SOURCE_LABEL: Record<string, string> = {
  client: 'مرورگر',
  boundary: 'مرز خطای رابط',
  server: 'سرور',
};

function faNumber(value: number, digits = 0): string {
  return value.toLocaleString('fa-IR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** CLS is unitless; the timing metrics read better as seconds past 1000ms. */
function metricValue(metric: string, value: number, count: number): string {
  if (count === 0) return '—';
  if (metric === 'CLS') return faNumber(value, 3);
  return value >= 1000
    ? `${faNumber(value / 1000, 1)} ثانیه`
    : `${faNumber(Math.round(value))} میلی‌ثانیه`;
}

function faDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function RatingPill({ rating }: { rating: VitalRating }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold ${RATING_CLASS[rating]}`}
    >
      {RATING_LABEL[rating]}
    </span>
  );
}

function MetricCard({ vital }: { vital: MonitorVitalSummary | undefined }) {
  if (!vital) return null;
  return (
    <div className="rounded-card border border-line bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-extrabold text-muted" dir="ltr">
          {vital.metric} p75
        </span>
        <RatingPill rating={vital.rating} />
      </div>
      <p className="mt-1 text-lg font-extrabold">{metricValue(vital.metric, vital.p75, vital.count)}</p>
      <p className="text-[11px] text-faint">
        {vital.count > 0 ? `${faNumber(vital.count)} نمونه` : 'بدون نمونه'}
      </p>
    </div>
  );
}

export default async function MonitoringPage() {
  const { session, access } = await adminGate();
  if (access === 'guest') redirect('/login?next=/admin/monitoring');
  if (access !== 'admin' || !session) notFound();

  const summary = monitorSnapshot();
  const vitalBy = new Map(summary.vitals.map((vital) => [vital.metric, vital]));
  const hasSamples = summary.vitals.some((vital) => vital.count > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold">پایش و سلامت</h1>
          <p className="mt-1 text-xs text-muted">
            خطاهای {faNumber(summary.windowHours)} ساعت گذشته و شاخص‌های تجربهٔ واقعی کاربران.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink"
        >
          <Icon name="arrowLeft" size={16} />
          پنل مدیریت
        </Link>
      </div>

      <section
        className={`rounded-card border p-4 ${
          summary.errorCount > 0 ? 'border-bad/40 bg-bad-soft' : 'border-line bg-card'
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-extrabold">خطاهای گزارش‌شده</h2>
          <span className="text-xs font-bold text-muted">
            {summary.errors.length > 0
              ? `${faNumber(summary.errors.length)} نوع متمایز`
              : 'بدون خطا'}
          </span>
        </div>
        <p className="mt-1 text-2xl font-extrabold">{faNumber(summary.errorCount)}</p>
        {summary.errorCount === 0 ? (
          <p className="mt-1 text-xs text-muted">
            در این بازه هیچ خطای سرور یا رابط کاربری گزارش نشده است.
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">
            این عدد شامل خطاهای سرور، مرزهای خطای صفحه و استثناهای گزارش‌شده از مرورگر است.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-extrabold">شاخص‌های وب حیاتی (p75)</h2>
          <span className="text-[11px] text-faint">درصد ۷۵ کاربران سریع‌تر از این مقدار</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricCard vital={vitalBy.get('LCP')} />
          <MetricCard vital={vitalBy.get('INP')} />
          <MetricCard vital={vitalBy.get('CLS')} />
          <MetricCard vital={vitalBy.get('FCP')} />
          <MetricCard vital={vitalBy.get('TTFB')} />
        </div>
        {!hasSamples ? (
          <p className="rounded-card border border-line bg-card px-4 py-3 text-xs text-muted">
            هنوز نمونه‌ای ثبت نشده است. با بازدید صفحه‌ها، شاخص‌ها خودکار ارسال می‌شوند؛ در
            محیط توسعه ارسال انجام نمی‌شود.
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold">کندترین مسیرها</h2>
        {summary.slowRoutes.length === 0 ? (
          <p className="rounded-card border border-line bg-card px-4 py-3 text-xs text-muted">
            {hasSamples
              ? 'همهٔ مسیرهای دارای نمونه در محدودهٔ سالم هستند.'
              : 'برای مقایسهٔ مسیرها به نمونهٔ بیشتری نیاز است.'}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {summary.slowRoutes.map((row) => (
              <li
                key={`${row.metric}-${row.route}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold" dir="ltr">
                    {row.route}
                  </p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    <span dir="ltr">{row.metric}</span> · {faNumber(row.count)} نمونه
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold">
                    {metricValue(row.metric, row.p75, row.count)}
                  </span>
                  <RatingPill rating={row.rating} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-extrabold">خطاهای تکراری</h2>
        {summary.errors.length === 0 ? (
          <p className="rounded-card border border-line bg-card px-4 py-3 text-xs text-muted">
            خطایی برای دسته‌بندی وجود ندارد.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {summary.errors.slice(0, 15).map((group) => (
              <li key={group.key} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 break-words text-xs font-bold" dir="auto">
                    {group.message}
                  </p>
                  <span className="rounded-full bg-cta-soft px-2 py-0.5 text-[11px] font-extrabold text-ink">
                    {faNumber(group.count)} بار
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
                  <span dir="ltr">{group.route}</span>
                  <span>·</span>
                  <span>{SOURCE_LABEL[group.source] ?? group.source}</span>
                  <span>·</span>
                  <span>{faDateTime(group.lastSeen)}</span>
                  {group.digest ? (
                    <>
                      <span>·</span>
                      <span dir="ltr">کد {group.digest}</span>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-line bg-card p-4 text-xs leading-6 text-muted">
        <h2 className="mb-1 text-sm font-extrabold text-ink">مقصد داده‌ها و بررسی در دسترس بودن</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            نقطهٔ پایانی سالم‌بودن:{' '}
            <span className="font-bold text-ink" dir="ltr">
              /api/health
            </span>{' '}
            — پاسخ ۲۰۰ یعنی کلید نشست و مسیر ورود آماده‌اند، ۵۰۳ یعنی کاربردپذیری ناقص است.
          </li>
          <li>
            گردش کار «Uptime» در GitHub Actions هر ۱۰ دقیقه همین مسیر را می‌سنجد و در صورت
            خطا، اجرای ناموفق (و اعلان پیش‌فرض GitHub) ثبت می‌کند.
          </li>
          <li>
            وب‌هوک پایش:{' '}
            {summary.config.webhookHost ? (
              <span className="font-bold text-ink" dir="ltr">
                {summary.config.webhookHost}
              </span>
            ) : (
              'تنظیم نشده — گزارش‌ها در همین استقرار و در لاگ‌های سرور با برچسب [alisales:monitor] نگه داشته می‌شوند.'
            )}
          </li>
          {summary.config.uptimeUrl ? (
            <li>
              نشانی پایش‌شده:{' '}
              <span className="font-bold text-ink" dir="ltr">
                {summary.config.uptimeUrl}
              </span>
            </li>
          ) : null}
          <li>
            برای خواندن همین داده به‌صورت JSON، با هدر{' '}
            <span dir="ltr">Authorization: Bearer …</span> به{' '}
            <span dir="ltr">/api/monitor</span> مراجعه کنید (نشست مدیر هم پذیرفته می‌شود).
          </li>
        </ul>
      </section>
    </div>
  );
}
