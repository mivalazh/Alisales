'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

/**
 * «نوبت‌دهی کارشناسی فنی در تعمیرگاه شمس‌اله» — the platform-level offer.
 *
 * Rendered under the seller card on every listing and on /inspection. The
 * modal is deliberately short (name, phone, date, time, vehicle) because this
 * is a lead form filled on a phone, often at the side of the road; everything
 * else is optional. The booking lands in the /admin inspection queue.
 */
export function InspectionOffer({
  listingSlug,
  listingTitle,
  compact = false,
}: {
  listingSlug?: string | null;
  listingTitle?: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="rounded-card border border-[#F98513]/40 bg-gradient-to-br from-[#FFF7EC] to-white p-4 sm:p-5 dark:from-[#2a2418] dark:to-[#171b2c]">
        <p className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F98513] text-white">
            <Icon name="shieldCheck" size={17} />
          </span>
          نوبت‌دهی کارشناسی فنی در تعمیرگاه شمس‌اله
        </p>
        <p className="mt-2 text-xs leading-6 text-ink/80">
          آفر ویژه کاربران سایت: <b className="font-extrabold text-[#B45309]">۲۰٪ تخفیف</b>{' '}
          کارشناسی کامل موتور، گیربکس، بدنه و دیاگ تخصصی پیش از خرید + صدور برگه ضمانت
          کارشناسی.
        </p>
        {!compact && (
          <ul className="mt-3 grid gap-1.5 text-[11px] font-bold text-muted sm:grid-cols-2">
            <li className="flex items-center gap-1.5">
              <Icon name="check" size={13} className="text-[#F98513]" />
              گزارش فنی مکتوب برای مذاکره با فروشنده
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="check" size={13} className="text-[#F98513]" />
              دیاگ تخصصی و بررسی سابقه‌ی تصادف
            </li>
          </ul>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[#111144] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#1b1b5c] sm:w-auto"
        >
          رزرو نوبت کارشناسی با آفر ویژه
        </button>
        <p className="mt-2 text-[10px] text-faint">
          پاسخ‌گویی شنبه تا پنجشنبه، ۹ تا ۱۸ — تعمیرگاه تخصصی شمس‌اله، کیش.
        </p>
      </section>

      {open && (
        <BookingModal
          listingSlug={listingSlug ?? null}
          listingTitle={listingTitle ?? null}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function BookingModal({
  listingSlug,
  listingTitle,
  onClose,
}: {
  listingSlug: string | null;
  listingTitle: string | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    date: '',
    time: '',
    vehicle: listingTitle ?? '',
    note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, listingSlug, listingTitle }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(body.error ?? 'ثبت نوبت انجام نشد.');
        return;
      }
      setDone(true);
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="رزرو نوبت کارشناسی"
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-card border border-line bg-card p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cta-soft text-cta">
            <Icon name="shieldCheck" size={18} />
          </span>
          <h2 className="text-sm font-extrabold">رزرو کارشناسی تعمیرگاه شمس‌اله</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="ms-auto flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-cta-soft hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {done ? (
          <div className="mt-4 space-y-2 text-sm">
            <p className="rounded-field border border-ok/40 bg-ok/10 px-3 py-2 font-bold text-ok">
              نوبت شما ثبت شد؛ کارشناس تعمیرگاه برای تأیید ساعت با شما تماس می‌گیرد.
            </p>
            <p className="text-xs leading-6 text-muted">
              آفر ۲۰٪ تخفیف روی همین نوبت اعمال می‌شود. برگه‌ی ضمانت کارشناسی پس از
              بازدید صادر می‌شود.
            </p>
            <button type="button" onClick={onClose} className="btn-cta w-full text-sm">
              بستن
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-2.5">
            <input
              className="field"
              placeholder="نام و نام خانوادگی"
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
            />
            <input
              className="field"
              inputMode="tel"
              dir="ltr"
              placeholder="09xxxxxxxxx"
              value={form.phone}
              onChange={(event) => set('phone', event.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="field"
                type="date"
                aria-label="تاریخ نوبت"
                value={form.date}
                onChange={(event) => set('date', event.target.value)}
              />
              <input
                className="field"
                type="time"
                aria-label="ساعت نوبت"
                value={form.time}
                onChange={(event) => set('time', event.target.value)}
              />
            </div>
            <input
              className="field"
              placeholder="خودروی مورد بررسی (مثلاً لندکروزر ۲۰۲۲)"
              value={form.vehicle}
              onChange={(event) => set('vehicle', event.target.value)}
            />
            <input
              className="field"
              placeholder="توضیح اختیاری (سابقه، قطعه، نگرانی…)"
              value={form.note}
              onChange={(event) => set('note', event.target.value)}
            />

            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              className="btn-cta w-full text-sm disabled:opacity-60"
            >
              {busy ? 'در حال ثبت…' : 'ثبت نوبت با ۲۰٪ تخفیف'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
