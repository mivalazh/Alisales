'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

/**
 * «حذف آگهی» — a destructive action that always asks first.
 *
 * The confirmation is an in-page modal (not `window.confirm`) so the wording,
 * the focus trap-ish behaviour and the error surface are ours. On success the
 * row is gone from the server, the signed my-listings cookie no longer carries
 * it, and the caller decides where to land: «آگهی‌های من» refreshes in place,
 * the listing page goes back to the profile.
 */
export function DeleteListingButton({
  id,
  label = 'حذف آگهی',
  redirectTo,
  compact = false,
}: {
  id: string;
  label?: string;
  /** Where to go after a successful delete; omit to just `router.refresh()`. */
  redirectTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function remove(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${id}`, { method: 'DELETE' });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 401) {
        router.push(`/login?next=/profile/listings`);
        return;
      }
      if (!res.ok) {
        setError(body.error ?? 'حذف آگهی انجام نشد.');
        return;
      }
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? 'inline-flex items-center gap-1 rounded-field border border-line px-2 py-1 text-[11px] font-bold text-red-600 transition hover:border-red-300'
            : 'btn-ghost text-sm text-red-600'
        }
      >
        <Icon name="trash" size={compact ? 13 : 16} />
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`delete-${id}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => (busy ? undefined : setOpen(false))}
        >
          <div
            className="w-full max-w-sm rounded-card border border-line bg-card p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Icon name="trash" size={18} />
              </span>
              <h2 id={`delete-${id}`} className="text-sm font-extrabold">
                آیا از حذف دائمی این آگهی مطمئن هستید؟
              </h2>
            </div>
            <p className="mt-3 text-xs leading-6 text-muted">
              این آگهی و عکس‌هایش برای همیشه پاک می‌شود؛ امکان بازگردانی وجود ندارد.
            </p>
            {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="btn-ghost h-10 flex-1 text-sm disabled:opacity-60"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-red-600 px-4 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                <Icon name="trash" size={15} />
                {busy ? 'در حال حذف…' : 'حذف دائمی'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
