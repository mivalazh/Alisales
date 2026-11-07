'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatJalaliDate } from '@alisales/schemas';
import { Icon } from './Icon';
import { AdminRateForm } from './AdminRateForm';
import { isPreSizedSource } from '@/lib/images';
import type { AdminCenterData, AdminListingRow } from '@/lib/data/admin-center';

/**
 * Owner control centre.
 *
 * Five tabs, one server read, and every mutation posted to `/api/admin` where
 * ownership is re-checked. Nothing is optimistically removed: a refresh reads
 * the real store, so a rejected action shows the server's reason instead of a
 * row that silently reappears.
 */

type TabKey = 'listings' | 'stories' | 'inspections' | 'rate' | 'inbox';

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: 'listings', label: 'مدیریت آگهی‌ها' },
  { key: 'stories', label: 'استوری‌ها و تعرفه‌ها' },
  { key: 'inspections', label: 'نوبت‌های کارشناسی' },
  { key: 'rate', label: 'نرخ درهم و تنظیمات' },
  { key: 'inbox', label: 'گزارش‌ها، تیکت‌ها و پیشنهادات' },
];

function toman(irr: number): string {
  return Math.round(irr / 10).toLocaleString('en-US');
}

function dateLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : formatJalaliDate(date);
}

const STATE_LABEL: Record<string, string> = {
  active: 'فعال',
  sold: 'فروخته‌شده',
  paused: 'متوقف',
  pending_review: 'در انتظار',
  rejected: 'ردشده',
  draft: 'پیش‌نویس',
  expired: 'منقضی',
};

export function AdminDashboard({ data }: { data: AdminCenterData }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('listings');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'vehicle' | 'part'>('all');

  async function run(
    action: string,
    id: string,
    key: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, id, ...extra }),
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

  const { queues, rate, settings } = data;
  const pendingStories = data.storySubmissions.filter((story) => story.status === 'pending').length;
  const openInspections = data.inspections.filter((booking) => booking.status !== 'done').length;

  const listings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.listings.filter((listing) => {
      if (kindFilter !== 'all' && listing.kind !== kindFilter) return false;
      if (!q) return true;
      return `${listing.title} ${listing.slug} ${listing.city}`.toLowerCase().includes(q);
    });
  }, [data.listings, kindFilter, query]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header>
        <h1 className="text-xl font-extrabold">مرکز کنترل مالک</h1>
        <p className="mt-1 text-sm text-muted">
          آگهی‌ها، استوری‌ها، نوبت‌های کارشناسی، نرخ درهم و صندوق پیام‌ها — از یک صفحه.
        </p>
      </header>

      <nav aria-label="بخش‌های مدیریت" className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 rounded-[var(--radius-pill)] border px-3 py-2 text-xs font-extrabold transition ${
                active
                  ? 'border-cta bg-cta-soft text-ink'
                  : 'border-line bg-card text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

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

      {tab === 'listings' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="field h-9 max-w-xs flex-1 text-xs"
              placeholder="جستجوی عنوان یا شناسه‌ی آگهی…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="flex gap-1">
              {(
                [
                  { key: 'all', label: 'همه' },
                  { key: 'vehicle', label: 'خودرو' },
                  { key: 'part', label: 'قطعه' },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={kindFilter === option.key}
                  onClick={() => setKindFilter(option.key)}
                  className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-[11px] font-extrabold ${
                    kindFilter === option.key
                      ? 'border-cta bg-cta-soft text-ink'
                      : 'border-line text-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <span className="ms-auto text-[11px] font-bold text-faint">
              {listings.length} آگهی
            </span>
          </div>

          <ul className="space-y-2">
            {listings.slice(0, 60).map((listing: AdminListingRow) => (
              <li
                key={listing.id}
                className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-card p-2.5"
              >
                <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-sunken">
                  {listing.coverUrl ? (
                    <Image
                      src={listing.coverUrl}
                      alt={listing.title}
                      fill
                      sizes="64px"
                      unoptimized={isPreSizedSource(listing.coverUrl)}
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[8px] text-faint">
                      No image
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ink">{listing.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {STATE_LABEL[listing.state] ?? listing.state} · {toman(listing.priceIRR)} تومان
                    {listing.featured && (
                      <span className="ms-1 rounded-[var(--radius-pill)] bg-cta-soft px-1.5 text-[10px] font-bold text-ink">
                        ویژه
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      void run('listing-feature', listing.id, `f-${listing.id}`, {
                        featured: !listing.featured,
                      })
                    }
                    disabled={busy !== null}
                    className="rounded-[var(--radius-pill)] border border-line px-2.5 py-1 text-[11px] font-bold text-muted hover:text-ink disabled:opacity-50"
                  >
                    {listing.featured ? 'حذف ویژه' : 'ویژه'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void run('listing-bump', listing.id, `b-${listing.id}`)}
                    disabled={busy !== null}
                    className="rounded-[var(--radius-pill)] border border-line px-2.5 py-1 text-[11px] font-bold text-muted hover:text-ink disabled:opacity-50"
                  >
                    نوکردن
                  </button>
                  <button
                    type="button"
                    onClick={() => void run('listing-pause', listing.id, `p-${listing.id}`)}
                    disabled={busy !== null || listing.state === 'paused'}
                    className="rounded-[var(--radius-pill)] border border-line px-2.5 py-1 text-[11px] font-bold text-muted hover:text-ink disabled:opacity-50"
                  >
                    توقف
                  </button>
                  <button
                    type="button"
                    onClick={() => void run('listing-remove', listing.id, `x-${listing.id}`)}
                    disabled={busy !== null}
                    className="rounded-[var(--radius-pill)] border border-bad/40 px-2.5 py-1 text-[11px] font-bold text-bad hover:bg-bad/10 disabled:opacity-50"
                  >
                    حذف
                  </button>
                  <Link
                    href={`/listing/${listing.slug}`}
                    className="rounded-[var(--radius-pill)] border border-line px-2.5 py-1 text-[11px] font-bold text-muted hover:text-ink"
                  >
                    نمایش
                  </Link>
                </div>
              </li>
            ))}
            {listings.length === 0 && (
              <li className="rounded-card border border-dashed border-line bg-page p-4 text-sm text-muted">
                آگهی‌ای با این جستجو پیدا نشد.
              </li>
            )}
          </ul>
        </section>
      )}

      {tab === 'stories' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-card p-4">
            <div className="min-w-0">
              <p className="text-sm font-extrabold">تعرفه‌ی ثبت استوری</p>
              <p className="mt-1 text-[11px] text-muted">
                {settings.storyPaidGuard
                  ? 'روشن: ثبت استوری نیازمند اشتراک/بسته است و در صف تأیید می‌ماند.'
                  : 'خاموش: طرح افتتاحیه — استوری برای همه رایگان و بلافاصله منتشر می‌شود.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.storyPaidGuard}
              onClick={() =>
                void run('story-guard-toggle', 'story-guard', 'sg', {
                  enabled: !settings.storyPaidGuard,
                })
              }
              disabled={busy !== null}
              className={`flex h-8 w-14 items-center rounded-full border p-0.5 transition ${
                settings.storyPaidGuard
                  ? 'justify-end border-cta bg-cta'
                  : 'justify-start border-line bg-sunken'
              }`}
            >
              <span className="h-6 w-6 rounded-full bg-white shadow" />
            </button>
          </div>

          <div>
            <h2 className="text-sm font-extrabold">
              استوری‌های کاربران {pendingStories > 0 && `· ${pendingStories} در انتظار`}
            </h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {data.storySubmissions.length === 0 && (
                <li className="rounded-card border border-dashed border-line bg-page p-4 text-sm text-muted">
                  هنوز استوری‌ای ثبت نشده است.
                </li>
              )}
              {data.storySubmissions.map((story) => (
                <li key={story.id} className="rounded-card border border-line bg-card p-3">
                  <div className="flex items-start gap-2">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sunken">
                      {story.mediaKind === 'video' ? (
                        <video src={story.mediaUrl} muted className="h-full w-full object-cover" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={story.mediaUrl} alt={story.title} className="h-full w-full object-cover" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold">{story.title}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {story.authorName || 'کاربر'} · {dateLabel(story.createdAt)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold text-faint">
                        {story.status === 'approved'
                          ? 'منتشرشده'
                          : story.status === 'pending'
                            ? 'در انتظار تأیید'
                            : 'ردشده'}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => void run('story-submission-approve', story.id, `sta-${story.id}`)}
                      disabled={busy !== null || story.status === 'approved'}
                      className="flex-1 rounded-[var(--radius-pill)] border border-line px-2 py-1 text-[11px] font-bold disabled:opacity-40"
                    >
                      تأیید
                    </button>
                    <button
                      type="button"
                      onClick={() => void run('story-submission-reject', story.id, `str-${story.id}`)}
                      disabled={busy !== null || story.status === 'rejected'}
                      className="flex-1 rounded-[var(--radius-pill)] border border-line px-2 py-1 text-[11px] font-bold disabled:opacity-40"
                    >
                      رد
                    </button>
                    <button
                      type="button"
                      onClick={() => void run('story-submission-delete', story.id, `std-${story.id}`)}
                      disabled={busy !== null}
                      className="rounded-[var(--radius-pill)] border border-bad/40 px-2 py-1 text-[11px] font-bold text-bad disabled:opacity-40"
                    >
                      حذف
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-extrabold">استوری‌های کاتالوگ (آگهی‌ها)</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {queues.stories.slice(0, 12).map((story) => (
                <li key={story.slug} className="flex items-center gap-2 rounded-card border border-line bg-card p-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-bold">{story.title}</span>
                  <button
                    type="button"
                    onClick={() => void run('story-approve', story.slug, `sa-${story.slug}`)}
                    disabled={busy !== null}
                    className="rounded-[var(--radius-pill)] border border-line px-2 py-1 text-[10px] font-bold"
                  >
                    تأیید
                  </button>
                  <button
                    type="button"
                    onClick={() => void run('story-reject', story.slug, `sr-${story.slug}`)}
                    disabled={busy !== null}
                    className="rounded-[var(--radius-pill)] border border-line px-2 py-1 text-[10px] font-bold"
                  >
                    رد
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {tab === 'inspections' && (
        <section className="space-y-2">
          <h2 className="text-sm font-extrabold">
            نوبت‌های کارشناسی تعمیرگاه شمس‌اله {openInspections > 0 && `· ${openInspections} باز`}
          </h2>
          <ul className="space-y-2">
            {data.inspections.length === 0 && (
              <li className="rounded-card border border-dashed border-line bg-page p-4 text-sm text-muted">
                هنوز درخواست کارشناسی ثبت نشده است. فرم رزرو در صفحه‌ی آگهی و /inspection قرار دارد.
              </li>
            )}
            {data.inspections.map((booking) => (
              <li key={booking.id} className="rounded-card border border-line bg-card p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold">
                      {booking.name} · <span dir="ltr">{booking.phone}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-muted">
                      {booking.vehicle} · {booking.date} {booking.time}
                      {booking.listingTitle && ` · آگهی: ${booking.listingTitle}`}
                    </p>
                    {booking.note && <p className="mt-1 text-[11px] text-ink/80">{booking.note}</p>}
                  </div>
                  <span className="rounded-[var(--radius-pill)] border border-line bg-page px-2 py-0.5 text-[10px] font-bold text-muted">
                    {booking.status === 'pending'
                      ? 'در انتظار'
                      : booking.status === 'confirmed'
                        ? 'تأییدشده'
                        : booking.status === 'done'
                          ? 'انجام‌شده'
                          : 'لغو'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      void run('inspection-update', booking.id, `ic-${booking.id}`, {
                        status: 'confirmed',
                      })
                    }
                    disabled={busy !== null || booking.status === 'confirmed'}
                    className="rounded-[var(--radius-pill)] border border-line px-2.5 py-1 text-[11px] font-bold disabled:opacity-40"
                  >
                    تأیید نوبت
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void run('inspection-update', booking.id, `id-${booking.id}`, { status: 'done' })
                    }
                    disabled={busy !== null || booking.status === 'done'}
                    className="rounded-[var(--radius-pill)] border border-line px-2.5 py-1 text-[11px] font-bold disabled:opacity-40"
                  >
                    انجام شد
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void run('inspection-update', booking.id, `ix-${booking.id}`, {
                        status: 'cancelled',
                      })
                    }
                    disabled={busy !== null}
                    className="rounded-[var(--radius-pill)] border border-bad/40 px-2.5 py-1 text-[11px] font-bold text-bad disabled:opacity-40"
                  >
                    لغو
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === 'rate' && (
        <section className="space-y-3">
          <AdminRateForm initial={rate} />
          <p className="rounded-field border border-line bg-page px-3 py-2 text-xs leading-6 text-muted">
            وضعیت دریافت خودکار:{' '}
            <b className="text-ink">
              {rate.source === 'auto'
                ? 'فعال — آخرین نرخ از بازار خوانده شده است'
                : rate.source === 'admin'
                  ? 'نرخ دستی مالک اعمال است'
                  : 'نرخ پیش‌فرض (بدون دریافت خودکار)'}
            </b>
            . نرخ فعلی {Math.round(rate.aedToIrr / 10).toLocaleString('en-US')} تومان برای هر درهم.
          </p>
        </section>
      )}

      {tab === 'inbox' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-extrabold">گزارش‌های آگهی ({queues.reports.length})</h2>
            <ul className="mt-2 space-y-2">
              {queues.reports.length === 0 && (
                <li className="rounded-card border border-dashed border-line bg-page p-4 text-sm text-muted">
                  گزارشی در انتظار بررسی نیست.
                </li>
              )}
              {queues.reports.map((report) => (
                <li key={report.id} className="rounded-card border border-line bg-card p-3">
                  <p className="text-sm font-extrabold">{report.listingTitle}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {report.reason} · {report.dateLabel}
                  </p>
                  {report.details && <p className="mt-1 text-xs text-ink/80">{report.details}</p>}
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => void run('report-dismiss', report.id, `d-${report.id}`)}
                      disabled={busy !== null}
                      className="rounded-[var(--radius-pill)] border border-line px-2.5 py-1 text-[11px] font-bold disabled:opacity-40"
                    >
                      رد گزارش
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void run('report-act', report.id, `a-${report.id}`, {
                          listingId: report.listingId,
                        })
                      }
                      disabled={busy !== null}
                      className="rounded-[var(--radius-pill)] border border-bad/40 px-2.5 py-1 text-[11px] font-bold text-bad disabled:opacity-40"
                    >
                      توقف آگهی
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-extrabold">تیکت‌ها و پیشنهادات کاربران</h2>
            <ul className="mt-2 space-y-2">
              {data.tickets.length === 0 && (
                <li className="rounded-card border border-dashed border-line bg-page p-4 text-sm text-muted">
                  پیامی از کاربران ثبت نشده است. فرم پشتیبانی و پیشنهادات در /support است.
                </li>
              )}
              {data.tickets.slice(0, 30).map((ticket) => (
                <li key={ticket.id} className="rounded-card border border-line bg-card p-3">
                  <p className="text-sm font-extrabold">
                    {ticket.kind === 'brand' ? 'پیشنهاد' : 'تیکت'} از {ticket.name}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    <span dir="ltr">{ticket.contact}</span> · {dateLabel(ticket.createdAt)}
                    {ticket.model && ` · ${ticket.model}`}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-xs leading-6 text-ink/85">
                    {ticket.message}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-extrabold">درخواست‌های احراز نمایشگاه ({queues.verifications.length})</h2>
            <ul className="mt-2 space-y-2">
              {queues.verifications.length === 0 && (
                <li className="rounded-card border border-dashed border-line bg-page p-4 text-sm text-muted">
                  درخواستی در انتظار نیست.
                </li>
              )}
              {queues.verifications.map((item) => (
                <li key={item.id} className="flex items-center gap-2 rounded-card border border-line bg-card p-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.displayName}</span>
                  <button
                    type="button"
                    onClick={() => void run('verification-approve', item.id, `va-${item.id}`)}
                    disabled={busy !== null}
                    className="rounded-[var(--radius-pill)] border border-line px-2 py-1 text-[11px] font-bold"
                  >
                    تأیید
                  </button>
                  <button
                    type="button"
                    onClick={() => void run('verification-reject', item.id, `vr-${item.id}`)}
                    disabled={busy !== null}
                    className="rounded-[var(--radius-pill)] border border-line px-2 py-1 text-[11px] font-bold"
                  >
                    رد
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <p className="flex items-center gap-2 text-xs text-faint">
        <Icon name="gear" size={14} />
        {queues.overview.listings} آگهی در کاتالوگ، {queues.overview.sold} فروخته‌شده.
      </p>
    </div>
  );
}
