'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ABUSE_REASON_LABELS, abuseReasons, type AbuseReason } from '@alisales/schemas';

/**
 * «گزارش آگهی» (C1 / abuse_reports). A signed-in visitor submits one report per
 * listing with a reason and optional details; the server resolves the reporter
 * from the session (never the body) and the DB unique key rejects duplicates.
 * Guests are sent to login and come back to the same listing.
 */
export function ReportListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<AbuseReason>('fraud');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listingId, reason, details: details.trim() || undefined }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(pathname || '/')}`);
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (res.status === 409) {
        setMessage('این آگهی را قبلاً گزارش کرده‌اید.');
        return;
      }
      if (!res.ok) {
        setError(body?.error ?? 'ثبت گزارش انجام نشد.');
        return;
      }
      setMessage('گزارش شما ثبت شد و بررسی می‌شود.');
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setMessage(null);
          setError(null);
        }}
        aria-expanded={open}
        className="w-full rounded-[var(--radius-pill)] border border-line px-3 py-1.5 text-xs font-bold text-muted transition hover:border-line-strong hover:text-ink"
      >
        گزارش آگهی
      </button>

      {open && (
        <div className="space-y-2 rounded-card border border-line bg-card p-3">
          <label className="label" htmlFor="report-reason">
            دلیل گزارش
          </label>
          <select
            id="report-reason"
            className="field"
            value={reason}
            onChange={(e) => setReason(e.target.value as AbuseReason)}
          >
            {abuseReasons.map((item) => (
              <option key={item} value={item}>
                {ABUSE_REASON_LABELS[item]}
              </option>
            ))}
          </select>
          <label className="label" htmlFor="report-details">
            توضیح (اختیاری)
          </label>
          <textarea
            id="report-details"
            rows={3}
            className="field resize-y"
            maxLength={1000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="جزئیات گزارش…"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="btn-ghost w-full text-xs disabled:opacity-60"
          >
            {busy ? 'در حال ارسال…' : 'ارسال گزارش'}
          </button>
          {message && (
            <p role="status" className="text-xs font-bold text-note">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs font-bold text-bad">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
