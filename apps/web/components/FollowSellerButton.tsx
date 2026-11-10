'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

const CACHE_KEY = 'alisales.following';

function cacheFollow(following: boolean, sellerId: string): string[] {
  let ids: string[] = [];
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    ids = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    ids = [];
  }
  const set = new Set(ids);
  if (following) set.add(sellerId);
  else set.delete(sellerId);
  const next = [...set];
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked — the server row is still the source of truth.
  }
  return next;
}

/**
 * «دنبال کردن / دنبال‌شده ✓» on a showroom profile.
 *
 * Optimistically flips, then persists through `/api/follows`; a failure rolls
 * the label back so the button never lies. Followed showrooms lead the story
 * rail and the browse feeds on the next render, which is why the page refreshes
 * after a successful toggle. The device also mirrors the list in localStorage,
 * so the state is known instantly on a cold render.
 */
export function FollowSellerButton({
  sellerId,
  initialFollowing,
  authed,
  isOwner = false,
}: {
  sellerId: string;
  initialFollowing: boolean;
  authed: boolean;
  isOwner?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) return;
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        const cached = parsed.includes(sellerId);
        // The cached list wins only when the server has no row yet (a hosted
        // isolate that lost memory), never against a positive server answer.
        if (cached && !initialFollowing) setFollowing(true);
      }
    } catch {
      // ignore unreadable cache
    }
  }, [authed, initialFollowing, sellerId]);

  if (isOwner) return null;

  if (!authed) {
    return (
      <Link
        href={`/login?next=/seller/${sellerId}`}
        className="inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] border border-cta bg-cta-soft px-4 text-sm font-extrabold text-ink transition hover:border-cta"
      >
        <Icon name="plus" size={16} />
        {t('دنبال کردن', 'Follow')}
      </Link>
    );
  }

  async function toggle(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const next = !following;
    setFollowing(next);
    try {
      const res = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sellerId }),
      });
      const data = (await res.json().catch(() => ({}))) as { following?: boolean; error?: string };
      if (!res.ok) {
        setFollowing(!next);
        setNote(data.error ?? t('ثبت دنبال کردن ممکن نشد.', 'Could not update follow status.'));
        return;
      }
      setFollowing(Boolean(data.following));
      cacheFollow(Boolean(data.following), sellerId);
      // The follower count and the feed priority live in server components.
      router.refresh();
    } catch {
      setFollowing(!next);
      setNote(t('ارتباط با سرور برقرار نشد.', 'Could not connect to the server.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={`inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-pill)] border px-4 text-sm font-extrabold transition ${
          following
            ? 'border-line-strong bg-page text-ink hover:border-line-strong'
            : 'border-cta bg-cta text-white hover:opacity-90'
        } disabled:opacity-60`}
      >
        <Icon name={following ? 'shieldCheck' : 'plus'} size={16} />
        {following ? t('دنبال‌شده ✓', 'Following ✓') : t('دنبال کردن', 'Follow')}
      </button>
      {note && <span className="text-[11px] font-bold text-red-600">{note}</span>}
    </div>
  );
}
