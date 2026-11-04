'use client';

import { useState, type FormEvent } from 'react';
import { aedToToman, formatAedRateLine, type AedRate } from '@alisales/schemas';

/**
 * Owner control for the one AED reference rate.
 *
 * Saving here changes every AED figure on the site at once — cards, rows, the
 * detail page and the publish form all read the same stored value.
 */
export function AdminRateForm({ initial }: { initial: AedRate }) {
  const [rate, setRate] = useState<AedRate>(initial);
  const [value, setValue] = useState(String(aedToToman(initial.aedToIrr)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/rate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toman: Number(value.replace(/[٬,\s]/g, '')) }),
      });
      const data = (await res.json().catch(() => ({}))) as { rate?: AedRate; error?: string };
      if (res.ok && data.rate) {
        setRate(data.rate);
        setMessage('نرخ ذخیره شد و در همه‌ی صفحات اعمال می‌شود.');
      } else {
        setError(data.error ?? 'ذخیره نرخ انجام نشد.');
      }
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-card p-4 sm:p-5">
      <h2 className="text-sm font-extrabold">نرخ درهم</h2>
      <p className="mt-1 text-xs text-muted">
        مبنای همه‌ی تبدیل‌های درهم در سایت. تغییر این عدد، قیمت‌های درهم را در کارت‌ها،
        ردیف‌ها، صفحه‌ی آگهی و فرم ثبت آگهی هم‌زمان به‌روز می‌کند.
      </p>

      <p className="mt-3 rounded-field border border-line bg-page px-3 py-2 text-sm font-extrabold text-ink">
        {formatAedRateLine(rate)}
      </p>
      <p className="mt-1 text-[11px] text-muted">
        آخرین بروزرسانی: <time dateTime={rate.updatedAt}>{rate.updatedAt.slice(0, 16).replace('T', ' ')}</time>
        {rate.source === 'auto' ? ' (دریافت خودکار)' : rate.source === 'admin' ? ' (دستی)' : ' (نرخ پیش‌فرض)'}
      </p>

      <form onSubmit={(e) => void save(e)} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-40 flex-1">
          <label className="label" htmlFor="aed-rate">
            تومان برای هر ۱ درهم
          </label>
          <input
            id="aed-rate"
            className="field"
            inputMode="numeric"
            dir="ltr"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-cta text-sm" disabled={busy}>
          {busy ? 'در حال ذخیره…' : 'ذخیره نرخ'}
        </button>
      </form>

      {message && (
        <p className="mt-2 text-xs font-bold text-[var(--color-success-fg)]" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error-text mt-2" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
