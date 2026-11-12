'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ListingState } from '@alisales/schemas';
import { DeleteListingButton } from './DeleteListingButton';
import { useI18n } from '@/lib/i18n';

type Target = 'active' | 'paused' | 'sold';

const ACTION_LABELS: Record<Target, { fa: string; en: string }> = {
  active: { fa: 'فعال‌سازی مجدد', en: 'Reactivate' },
  paused: { fa: 'بایگانی', en: 'Archive' },
  sold: { fa: 'فروخته شد', en: 'Mark sold' },
};

/**
 * Row actions on «آگهی‌های من»: edit, mark sold, archive (paused) and
 * reactivate. Listing limits are disabled during the free launch period.
 */
export function ListingOwnerActions({ id, state }: { id: string; state: ListingState }) {
  const router = useRouter();
  const { t } = useI18n();
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
        setError(
          body?.error ?? t('تغییر وضعیت انجام نشد.', 'Could not change the listing status.'),
        );
        return;
      }
      router.refresh();
    } catch {
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not connect to the server.'));
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
        {t('ویرایش', 'Edit')}
      </Link>
      {targets.map((target) => (
        <button
          key={target}
          type="button"
          onClick={() => void change(target)}
          disabled={busy !== null}
          className="rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-xs font-bold text-muted transition hover:border-line-strong hover:text-ink disabled:opacity-60"
        >
          {busy === target
            ? t('در حال اعمال…', 'Applying…')
            : t(ACTION_LABELS[target].fa, ACTION_LABELS[target].en)}
        </button>
      ))}
      <DeleteListingButton id={id} compact />
      {error && (
        <span className="text-xs font-bold text-bad" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
