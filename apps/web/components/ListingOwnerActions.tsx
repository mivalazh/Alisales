'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FREE_THIRD_LISTING_MESSAGE, type ListingState } from '@alisales/schemas';

type Target = 'active' | 'paused' | 'sold';

const ACTION_LABELS: Record<Target, string> = {
  active: 'فعال‌سازی مجدد',
  paused: 'بایگانی',
  sold: 'فروخته شد',
};

/**
 * Row actions on «آگهی‌های من»: edit, mark sold, archive (paused) and
 * reactivate. Reactivation is a server decision — the two-active-listing cap
 * answers 403 with «برای آگهی سوم، پلن انتخاب کن.» and the plan preview link.
 */
export function ListingOwnerActions({ id, state }: { id: string; state: ListingState }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targets: Target[] =
    state === 'active' ? ['sold', 'paused'] : state === 'paused' || state === 'sold' ? ['active'] : [];

  async function change(target: Target): Promise<void> {
    if (busy) return;
    setBusy(target);
    setError(null);
    try {
      const res = await fetch(`/api/listings/${id}/state`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: target }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.status === 401) {
        router.push('/login?next=/profile/listings');
        return;
      }
      if (!res.ok) {
        setError(body?.error ?? 'تغییر وضعیت انجام نشد.');
        return;
      }
      router.refresh();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/edit/${id}`}
        className="rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-xs font-bold text-ink transition hover:border-line-strong"
      >
        ویرایش
      </Link>
      {targets.map((target) => (
        <button
          key={target}
          type="button"
          onClick={() => void change(target)}
          disabled={busy !== null}
          className="rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-xs font-bold text-muted transition hover:border-line-strong hover:text-ink disabled:opacity-60"
        >
          {busy === target ? 'در حال اعمال…' : ACTION_LABELS[target]}
        </button>
      ))}
      {error && (
        <span className="text-xs font-bold text-bad" role="alert">
          {error}
          {error === FREE_THIRD_LISTING_MESSAGE && (
            <Link href="/new" className="ms-1 underline">
              دیدن پلن‌ها
            </Link>
          )}
        </span>
      )}
    </div>
  );
}
