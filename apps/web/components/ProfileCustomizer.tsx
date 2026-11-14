'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { AvatarPicker } from './AvatarPicker';

const BIO_MAX = 400;

/**
 * Compact profile editor. Images are handled by the camera overlays directly on
 * the cover and avatar; this panel only edits the bio and offers curated
 * avatars. There is no second upload box competing with the hero controls.
 */
export function ProfileCustomizer({
  initial,
  embedded = false,
}: {
  initial: { bio: string; avatarUrl: string | null };
  /** Renders inside the profile hero instead of a separate card. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [bio, setBio] = useState(initial.bio);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setNote(null);
    setSaved(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bio }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNote(body.error ?? t('ذخیره پروفایل ناموفق بود.', 'Could not save the profile.'));
        return;
      }
      setSaved(true);
      setOpen(false);
      router.refresh();
    } catch {
      setNote(t('ارتباط با سرور برقرار نشد.', 'Could not reach the server.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      id="profile-editor"
      aria-label={t('ویرایش پروفایل', 'Edit profile')}
      className={
        embedded
          ? 'mt-3 scroll-mt-24 border-t border-line pt-3'
          : 'scroll-mt-24 rounded-card border border-line bg-card p-4 sm:p-5'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={embedded ? 'text-xs font-extrabold text-muted' : 'text-sm font-extrabold'}>
          {t('بایو و آواتار', 'Bio and avatar')}
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ms-auto rounded-[var(--radius-pill)] border border-line px-3 py-1.5 text-xs font-extrabold text-ink transition hover:border-line-strong"
        >
          {open ? t('بستن', 'Close') : t('ویرایش پروفایل', 'Edit profile')}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          <AvatarPicker currentUrl={initial.avatarUrl} />
          <div>
            <label htmlFor="bio" className="text-xs font-extrabold text-ink">
              {t('بایو / درباره من یا کسب‌وکار', 'Bio / about me or the business')}
            </label>
            <textarea
              id="bio"
              className="field mt-1 min-h-24"
              maxLength={BIO_MAX}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder={t(
                'چند خط صمیمی درباره خودتان یا کسب‌وکارتان بنویسید...',
                'A few friendly lines about you or your business...',
              )}
            />
            <p className="mt-1 text-[11px] font-bold text-faint">
              {t(`${bio.length} از ${BIO_MAX} نویسه`, `${bio.length} of ${BIO_MAX} characters`)}
            </p>
          </div>
        </div>
      )}

      {(open || saved) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {open && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="btn-cta h-10 px-4 text-sm disabled:opacity-60"
            >
              {busy ? t('در حال ذخیره…', 'Saving...') : t('ذخیره بایو', 'Save bio')}
            </button>
          )}
          {saved && (
            <span className="text-xs font-extrabold text-emerald-600">
              {t('ذخیره شد.', 'Saved.')}
            </span>
          )}
          {note && <span className="text-xs font-bold text-red-600">{note}</span>}
        </div>
      )}
    </section>
  );
}
