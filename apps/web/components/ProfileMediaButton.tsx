'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notifyAccountChanged } from '@/lib/auth/account-events';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';
import { GalleryPermissionDialog, useGalleryPicker } from './GalleryPermission';
import { AVATAR_EDGE_PX, COVER_EDGE_PX, profileImageBlob } from '@/lib/profile-image';

/** Compact camera control that sits directly on the cover or avatar. */
export function ProfileMediaButton({
  kind,
  label,
}: {
  kind: 'avatar' | 'cover';
  label: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const gallery = useGalleryPicker();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function picked(file: File | undefined): Promise<void> {
    if (!file) return;
    setBusy(true);
    setError(null);
    let uploadedUrl: string | null = null;
    try {
      const image = await profileImageBlob(
        file,
        kind === 'avatar' ? AVATAR_EDGE_PX : COVER_EDGE_PX,
      );
      const form = new FormData();
      form.append('file', new File([image.blob], 'profile.webp', { type: 'image/webp' }));
      form.append('kind', kind);
      form.append('width', String(image.width));
      form.append('height', String(image.height));

      const upload = await fetch('/api/media/profile', { method: 'POST', body: form });
      const uploaded = (await upload.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!upload.ok || !uploaded.url) {
        setError(uploaded.error ?? t('بارگذاری تصویر ناموفق بود.', 'Could not upload the image.'));
        return;
      }
      uploadedUrl = uploaded.url;
      // A fresh key per upload: the object path is unique anyway, and this also
      // busts any CDN/browser cache holding the previous artwork.
      const versionedUrl = `${uploaded.url}${uploaded.url.includes('?') ? '&' : '?'}v=${Date.now()}`;

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          kind === 'avatar' ? { avatarUrl: versionedUrl } : { coverUrl: versionedUrl },
        ),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        // The upload succeeded but the profile row did not; do not leave an orphan.
        void fetch('/api/media', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: uploaded.url }),
        });
        setError(body.error ?? t('ذخیره تصویر ناموفق بود.', 'Could not save the image.'));
        return;
      }
      // The header and every avatar read this event, so the new picture lands
      // in React state immediately — no manual reload.
      notifyAccountChanged();
      router.refresh();
    } catch (err) {
      if (uploadedUrl) {
        void fetch('/api/media', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: uploadedUrl }),
        });
      }
      setError(
        err instanceof Error
          ? err.message
          : t('خواندن تصویر ممکن نشد.', 'Could not read that image.'),
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => gallery.request(() => input.current?.click())}
        disabled={busy}
        aria-label={label}
        title={label}
        className={
          kind === 'cover'
            ? 'absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-[#111144]/80 text-white shadow-lg backdrop-blur transition hover:bg-[#111144] disabled:opacity-60'
            : 'absolute bottom-0 left-0 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[#F98513] text-white shadow-md ring-2 ring-white transition hover:bg-[#e0770f] disabled:opacity-60 dark:ring-[#111144]'
        }
      >
        <Icon name="camera" size={kind === 'cover' ? 17 : 14} />
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => void picked(event.target.files?.[0])}
      />
      {error && (
        <span
          role="alert"
          className="absolute bottom-2 left-2 z-20 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-bold leading-5 text-white shadow-lg"
        >
          {error}
        </span>
      )}
      <GalleryPermissionDialog
        open={gallery.pending}
        onAllow={gallery.allow}
        onCancel={gallery.cancel}
      />
    </>
  );
}
