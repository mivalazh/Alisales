'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './Icon';
import { isPreSizedSource } from '@/lib/images';
import type {
  ModerationQueues,
  ReportItem,
  StoryQueueItem,
  VerificationItem,
} from '@/lib/data/moderation';

/**
 * Owner moderation hub.
 *
 * Everything here is a *decision*, not a mutation of client state: a button
 * posts one action to `/api/admin`, the server authorizes it against the
 * session + `ADMIN_PHONES`, writes it, and `router.refresh()` re-reads the
 * queues. Nothing is optimistically removed, so a rejected action shows the
 * server's reason instead of a silently missing row.
 */

type Action =
  | 'report-dismiss'
  | 'report-act'
  | 'verification-approve'
  | 'verification-reject'
  | 'story-approve'
  | 'story-reject';

function OverviewCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'accent';
}) {
  return (
    <div
      className={`rounded-card border p-4 ${
        tone === 'accent' ? 'border-cta bg-cta-soft' : 'border-line bg-card'
      }`}
    >
      <p className="text-xs font-bold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function StatusChip({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const map = {
    pending: { label: 'در انتظار', className: 'border-line bg-page text-muted' },
    approved: { label: 'تأییدشده', className: 'border-ok/40 bg-ok/10 text-ok' },
    rejected: { label: 'ردشده', className: 'border-bad/40 bg-bad/10 text-bad' },
  } as const;
  const item = map[status];
  return (
    <span className={`rounded-[var(--radius-pill)] border px-2 py-0.5 text-[11px] font-bold ${item.className}`}>
      {item.label}
    </span>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <li className="rounded-card border border-dashed border-line bg-page p-4 text-sm text-muted">{children}</li>;
}

export function AdminDashboard({ queues }: { queues: ModerationQueues }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(
    action: Action | 'listing-pause' | 'listing-remove',
    id: string,
    key: string,
    listingId?: string,
  ): Promise<void> {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, id, listingId }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(body.error ?? 'عملیات انجام نشد.');
        return;
      }
      setNotice('ثبت شد.');
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(null);
    }
  }

  const { overview } = queues;
  const pendingReports = queues.reports.length;
  const pendingVerifications = queues.verifications.length;
  const pendingStories = queues.stories.filter((story) => story.status === 'pending').length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold">پنل مدیریت</h1>
          <p className="mt-1 text-sm text-muted">
            گزارش‌ها، درخواست‌های احراز و داستان‌ها — همه از همین‌جا.
          </p>
        </div>
        <nav aria-label="بخش‌ها" className="flex flex-wrap gap-1.5 text-xs font-bold">
          <a href="#reports" className="rounded-[var(--radius-pill)] border border-line px-3 py-1.5">
            گزارش‌ها ({pendingReports})
          </a>
          <a href="#verifications" className="rounded-[var(--radius-pill)] border border-line px-3 py-1.5">
            احراز ({pendingVerifications})
          </a>
          <a href="#stories" className="rounded-[var(--radius-pill)] border border-line px-3 py-1.5">
            داستان‌ها ({pendingStories})
          </a>
        </nav>
      </header>

      {(error || notice) && (
        <p
          role={error ? 'alert' : 'status'}
          className={`rounded-field border px-3 py-2 text-sm font-bold ${
            error ? 'border-bad/40 bg-bad/10 text-bad' : 'border-line bg-page text-muted'
          }`}
        >
          {error ?? notice}
        </p>
      )}

      <section aria-label="نمای کلی" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <OverviewCard label="خودرو فعال" value={String(overview.activeVehicles)} />
        <OverviewCard label="قطعه فعال" value={String(overview.activeParts)} />
        <OverviewCard label="کاربران" value={String(overview.users)} hint="کل حساب‌های ثبت‌شده" />
        <OverviewCard
          label="شهر فعال"
          value={overview.city.label}
          hint={overview.city.selectionEnabled ? 'انتخاب شهر: روشن' : 'انتخاب شهر: خاموش'}
          tone="accent"
        />
      </section>

      <p className="rounded-field border border-line bg-page px-3 py-2 text-xs leading-6 text-muted">
        {overview.city.note}
        {overview.hosted
          ? ' داده‌ها از Supabase خوانده می‌شوند.'
          : ' حالت دمو: تصمیم‌ها در فروشگاه موقت همین پیش‌نمایش ذخیره می‌شوند.'}
      </p>

      {/* Reports ------------------------------------------------------------ */}
      <section id="reports" aria-labelledby="reports-title" className="space-y-2">
        <h2 id="reports-title" className="text-base font-extrabold">
          صف گزارش‌های آگهی
        </h2>
        <ul className="space-y-2">
          {queues.reports.length === 0 && (
            <EmptyRow>
              گزارشی در انتظار بررسی نیست. هر کاربر واردشده می‌تواند از صفحه‌ی آگهی دکمه‌ی «گزارش آگهی» را بزند و
              گزارش همین‌جا ظاهر شود.
            </EmptyRow>
          )}
          {queues.reports.map((report: ReportItem) => (
            <li key={report.id} className="rounded-card border border-line bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">{report.listingTitle}</p>
                  <p className="mt-1 text-xs text-muted">
                    دلیل: {report.reason}
                    <span className="mx-1.5 text-faint">·</span>
                    {report.dateLabel}
                  </p>
                  {report.details && (
                    <p className="mt-2 rounded-field bg-page px-3 py-2 text-xs leading-6 text-ink">
                      {report.details}
                    </p>
                  )}
                </div>
                {report.listingSlug && (
                  <Link
                    href={`/listing/${report.listingSlug}`}
                    className="text-xs font-bold text-muted underline"
                  >
                    مشاهده آگهی
                  </Link>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void run('report-dismiss', report.id, `d-${report.id}`)}
                  disabled={busy !== null}
                  className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {busy === `d-${report.id}` ? '…' : 'رد گزارش'}
                </button>
                <button
                  type="button"
                  onClick={() => void run('report-act', report.id, `a-${report.id}`, report.listingId)}
                  disabled={busy !== null}
                  className="rounded-[var(--radius-pill)] border border-bad bg-bad/10 px-3 py-1.5 text-xs font-bold text-bad transition hover:bg-bad/15 disabled:opacity-60"
                >
                  {busy === `a-${report.id}` ? '…' : 'توقف آگهی'}
                </button>
                <button
                  type="button"
                  onClick={() => void run('listing-remove', report.listingId, `r-${report.id}`)}
                  disabled={busy !== null}
                  className="rounded-[var(--radius-pill)] border border-line px-3 py-1.5 text-xs font-bold text-muted transition hover:border-line-strong hover:text-ink disabled:opacity-60"
                >
                  {busy === `r-${report.id}` ? '…' : 'حذف آگهی'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Verifications ------------------------------------------------------ */}
      <section id="verifications" aria-labelledby="verifications-title" className="space-y-2">
        <h2 id="verifications-title" className="text-base font-extrabold">
          درخواست‌های احراز نمایشگاه / تعمیرگاه
        </h2>
        <ul className="space-y-2">
          {queues.verifications.length === 0 && (
            <EmptyRow>
              درخواستی در انتظار نیست. هر حساب جدیدی که با نوع «نمایشگاه» ثبت‌نام کند اینجا برای تأیید می‌آید.
            </EmptyRow>
          )}
          {queues.verifications.map((item: VerificationItem) => (
            <li key={item.id} className="rounded-card border border-line bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-2 text-sm font-extrabold text-ink">
                    {item.displayName}
                    {item.sample && (
                      <span className="rounded-[var(--radius-pill)] border border-dashed border-cta px-2 py-0.5 text-[10px] font-bold text-muted">
                        نمونه
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    <span dir="ltr">{item.phoneMasked}</span>
                    <span className="mx-1.5 text-faint">·</span>
                    {item.dateLabel}
                  </p>
                </div>
                <StatusChip status="pending" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void run('verification-approve', item.id, `va-${item.id}`)}
                  disabled={busy !== null}
                  className="btn-cta px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {busy === `va-${item.id}` ? '…' : 'تأیید'}
                </button>
                <button
                  type="button"
                  onClick={() => void run('verification-reject', item.id, `vr-${item.id}`)}
                  disabled={busy !== null}
                  className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-60"
                >
                  {busy === `vr-${item.id}` ? '…' : 'رد'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Stories ------------------------------------------------------------ */}
      <section id="stories" aria-labelledby="stories-title" className="space-y-2">
        <h2 id="stories-title" className="text-base font-extrabold">
          داستان‌ها (استوری صفحه‌ی اصلی)
        </h2>
        <p className="text-xs text-muted">
          آگهی‌های فعال دارای عکس. تأیید، آگهی را به ابتدای نوار داستان صفحه‌ی اصلی می‌برد.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {queues.stories.length === 0 && <EmptyRow>آگهی دارای عکسی برای نمایش در داستان‌ها نیست.</EmptyRow>}
          {queues.stories.map((story: StoryQueueItem) => (
            <li key={story.slug} className="rounded-card border border-line bg-card p-3">
              <div className="flex items-start gap-3">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-sunken">
                  <Image
                    src={story.coverUrl}
                    alt={story.title}
                    fill
                    sizes="56px"
                    unoptimized={isPreSizedSource(story.coverUrl)}
                    className="object-cover"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ink">{story.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusChip status={story.status} />
                    <Link href={`/listing/${story.slug}`} className="text-[11px] font-bold text-muted underline">
                      آگهی
                    </Link>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void run('story-approve', story.slug, `sa-${story.slug}`)}
                  disabled={busy !== null || story.status === 'approved'}
                  className="btn-ghost flex-1 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  {busy === `sa-${story.slug}` ? '…' : 'تأیید'}
                </button>
                <button
                  type="button"
                  onClick={() => void run('story-reject', story.slug, `sr-${story.slug}`)}
                  disabled={busy !== null || story.status === 'rejected'}
                  className="btn-ghost flex-1 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  {busy === `sr-${story.slug}` ? '…' : 'رد'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="flex items-center gap-2 text-xs text-faint">
        <Icon name="gear" size={14} />
        {overview.listings} آگهی در کاتالوگ، {overview.sold} فروخته‌شده.
      </p>
    </div>
  );
}

