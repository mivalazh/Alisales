'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';

export interface ProfileStory {
  id: string;
  title: string;
  mediaUrl: string;
  mediaKind: 'image' | 'video';
  listingSlug: string | null;
  status: string;
}

const STATUS_LABEL: Record<string, { fa: string; en: string }> = {
  approved: { fa: 'منتشرشده', en: 'Published' },
  pending: { fa: 'در انتظار تأیید', en: 'Pending' },
  rejected: { fa: 'ردشده', en: 'Rejected' },
};

/**
 * The signed-in user's own stories on /profile.
 *
 * Each tile deletes its story through `DELETE /api/stories/{id}` — the same
 * owner-checked route the viewer uses — and disappears immediately. The
 * two-step confirm keeps a stray thumb from deleting anything.
 */
export function ProfileStories({ initial }: { initial: ProfileStory[] }) {
  const { t } = useI18n();
  const [stories, setStories] = useState(initial);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setStories((list) => list.filter((story) => story.id !== id));
      setConfirmId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('حذف استوری انجام نشد.', 'Could not delete the story.'),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      id="my-stories"
      aria-label={t('استوری‌های من', 'My stories')}
      className="scroll-mt-24 rounded-card border border-line bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-ink">{t('استوری‌های من', 'My stories')}</h2>
        <span className="text-[11px] font-bold text-faint">{stories.length}</span>
      </div>

      {stories.length === 0 ? (
        <p className="mt-2 text-xs text-muted">
          {t(
            'هنوز استوری‌ای منتشر نکرده‌اید؛ از نوار استوری‌ها «افزودن استوری» را بزنید.',
            'You have not published a story yet — use “Add Story” in the story rail.',
          )}
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {stories.map((story) => {
            const status = STATUS_LABEL[story.status];
            return (
              <li key={story.id} className="min-w-0">
                <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-line bg-sunken">
                  {story.mediaKind === 'video' ? (
                    <video
                      src={story.mediaUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={story.mediaUrl}
                      alt={story.title}
                      className="h-full w-full object-cover"
                    />
                  )}

                  <span className="absolute inset-x-1 bottom-1 truncate rounded-lg bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {story.title}
                  </span>

                  {status && (
                    <span className="absolute inset-x-1 top-1 truncate rounded-lg bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {t(status.fa, status.en)}
                    </span>
                  )}

                  {confirmId === story.id ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/65 p-1.5">
                      <button
                        type="button"
                        onClick={() => void remove(story.id)}
                        disabled={busyId === story.id}
                        className="w-full rounded-full bg-red-600 px-2 py-1 text-[10px] font-extrabold text-white disabled:opacity-60"
                      >
                        {busyId === story.id
                          ? t('حذف…', 'Deleting…')
                          : t('حذف', 'Delete')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="w-full rounded-full bg-white/20 px-2 py-1 text-[10px] font-extrabold text-white"
                      >
                        {t('انصراف', 'Cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(story.id)}
                      aria-label={t('حذف استوری', 'Delete story')}
                      className="absolute end-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-red-600"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
