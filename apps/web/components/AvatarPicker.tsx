'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { CURATED_AVATARS } from '@/lib/avatars';

/** One-tap curated avatar grid shown inside the profile editor. */
export function AvatarPicker({ currentUrl }: { currentUrl: string | null }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string, avatarUrl: string): Promise<void> {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ avatarUrl }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? t('ذخیره آواتار ناموفق بود.', 'Could not save the avatar.'));
        return;
      }
      router.refresh();
    } catch {
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not reach the server.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-page/60 p-3">
      <p className="text-xs font-extrabold text-ink">
        {t('یا یک آواتار آماده انتخاب کنید', 'Or pick a ready-made avatar')}
      </p>
      <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {CURATED_AVATARS.map((avatar) => (
          <button
            key={avatar.id}
            type="button"
            onClick={() => void choose(avatar.id, avatar.url)}
            disabled={busy !== null}
            aria-label={lang === 'en' ? avatar.labelEn : avatar.label}
            title={lang === 'en' ? avatar.labelEn : avatar.label}
            className={`relative aspect-square overflow-hidden rounded-full border-2 transition hover:scale-105 disabled:opacity-60 ${
              currentUrl === avatar.url ? 'border-cta ring-2 ring-cta/30' : 'border-card'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar.url} alt="" className="h-full w-full object-cover" />
            {busy === avatar.id && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[9px] font-bold text-white">
                …
              </span>
            )}
          </button>
        ))}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
