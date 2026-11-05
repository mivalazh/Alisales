'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { AVATAR_EDGE_PX, COVER_EDGE_PX, profileImageDataUrl } from '@/lib/profile-image';

const CACHE_KEY = 'alisales.profile.custom';
const BIO_MAX = 400;

interface Values {
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
}

/**
 * «ویرایش پروفایل» — avatar, cover banner and bio, saved to the account.
 *
 * Both images are downscaled in the browser and sent as short WebP data URLs,
 * so there is no upload endpoint to babysit and nothing binary in the store.
 * The saved copy is mirrored into localStorage: on a hosted isolate that loses
 * its demo store, the owner still sees their own artwork on load and can press
 * «ذخیره» once to write it back.
 */
export function ProfileCustomizer({
  initial,
  displayName,
  initials,
}: {
  initial: Values;
  displayName: string;
  initials: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(initial);
  const [busy, setBusy] = useState<'avatar' | 'cover' | 'save' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  async function pick(kind: 'avatar' | 'cover', file: File | undefined): Promise<void> {
    if (!file) return;
    setBusy(kind);
    setNote(null);
    try {
      const url = await profileImageDataUrl(file, kind === 'avatar' ? AVATAR_EDGE_PX : COVER_EDGE_PX);
      setValues((v) => ({ ...v, [kind === 'avatar' ? 'avatarUrl' : 'coverUrl']: url }));
      setOpen(true);
    } catch (error) {
      setNote(error instanceof Error ? error.message : 'خواندن تصویر ممکن نشد.');
    } finally {
      setBusy(null);
    }
  }

  async function save(): Promise<void> {
    if (busy) return;
    setBusy('save');
    setNote(null);
    setSaved(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; profile?: Values };
      if (!res.ok) {
        setNote(data.error ?? 'ذخیره پروفایل ناموفق بود.');
        return;
      }
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(values));
      } catch {
        // Cache is a convenience only.
      }
      setSaved(true);
      setOpen(false);
      router.refresh();
    } catch {
      setNote('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(null);
    }
  }

  function clear(kind: 'avatar' | 'cover'): void {
    setValues((v) => ({ ...v, [kind === 'avatar' ? 'avatarUrl' : 'coverUrl']: null }));
  }

  return (
    <section aria-label="ویرایش پروفایل" className="rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold">پروفایل نمایشگاهی</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="rounded-[var(--radius-pill)] border border-line px-3 py-1.5 text-xs font-extrabold text-ink transition hover:border-line-strong"
        >
          {open ? 'بستن' : 'ویرایش پروفایل'}
        </button>
      </div>

      <p className="mt-1 text-xs text-muted">
        عکس پروفایل، کاور و بایو اختیاری است؛ اگر خالی بماند، نشان حرف اول نام و کاور پیش‌فرض نمایش داده می‌شود.
      </p>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-field border border-line bg-page p-3">
              <p className="text-xs font-extrabold text-ink">عکس پروفایل</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-card text-lg font-extrabold">
                  {values.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={values.avatarUrl} alt="عکس پروفایل" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </span>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => avatarInput.current?.click()}
                    disabled={busy !== null}
                    className="rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-xs font-extrabold text-ink transition hover:border-line-strong disabled:opacity-60"
                  >
                    {busy === 'avatar' ? 'در حال آماده‌سازی…' : 'انتخاب عکس'}
                  </button>
                  {values.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => clear('avatar')}
                      className="text-[11px] font-bold text-muted underline"
                    >
                      حذف عکس
                    </button>
                  )}
                </div>
                <input
                  ref={avatarInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void pick('avatar', e.target.files?.[0])}
                />
              </div>
            </div>

            <div className="rounded-field border border-line bg-page p-3">
              <p className="text-xs font-extrabold text-ink">کاور پروفایل</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-field border border-line bg-card text-faint">
                  {values.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={values.coverUrl} alt="کاور پروفایل" className="h-full w-full object-cover" />
                  ) : (
                    <Icon name="camera" size={18} />
                  )}
                </span>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => coverInput.current?.click()}
                    disabled={busy !== null}
                    className="rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-xs font-extrabold text-ink transition hover:border-line-strong disabled:opacity-60"
                  >
                    {busy === 'cover' ? 'در حال آماده‌سازی…' : 'انتخاب کاور'}
                  </button>
                  {values.coverUrl && (
                    <button
                      type="button"
                      onClick={() => clear('cover')}
                      className="text-[11px] font-bold text-muted underline"
                    >
                      حذف کاور
                    </button>
                  )}
                </div>
                <input
                  ref={coverInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void pick('cover', e.target.files?.[0])}
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="bio" className="text-xs font-extrabold text-ink">
              بایو / درباره من یا نمایشگاه
            </label>
            <textarea
              id="bio"
              className="field mt-1 min-h-24"
              maxLength={BIO_MAX}
              value={values.bio}
              onChange={(e) => setValues((v) => ({ ...v, bio: e.target.value }))}
              placeholder={`${displayName} — چه خودروهایی می‌فروشید، کجا هستید و چه چیزی شما را متفاوت می‌کند؟`}
            />
            <p className="mt-1 text-[11px] font-bold text-faint">
              {values.bio.length} از {BIO_MAX} نویسه
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
              disabled={busy !== null}
              className="btn-cta h-10 px-4 text-sm disabled:opacity-60"
            >
              {busy === 'save' ? 'در حال ذخیره…' : 'ذخیره پروفایل'}
            </button>
          )}
          {saved && <span className="text-xs font-extrabold text-emerald-600">ذخیره شد.</span>}
          {note && <span className="text-xs font-bold text-red-600">{note}</span>}
        </div>
      )}
    </section>
  );
}
