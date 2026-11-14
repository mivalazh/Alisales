'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emblemInk } from './BrandEmblem';
import { CustomSelect } from './CustomSelect';
import { GalleryPermissionDialog, useGalleryPicker } from './GalleryPermission';
import { Icon } from './Icon';
import { isPreSizedSource } from '@/lib/images';
import { mediaExtension } from '@/lib/media-rules';
import { processListingMedia } from '@/lib/photos';
import { useI18n } from '@/lib/i18n';

const StoryViewer = dynamic(
  () => import('./StoryViewer').then((module) => module.StoryViewer),
  { ssr: false },
);

export interface StoryItem {
  slug: string;
  title: string;
  coverUrl: string;
  href: string;
  /** Marque slug — the ring takes its accent colour. */
  brand?: string;
  /** Optional clip: when present the viewer plays it instead of the still. */
  videoUrl?: string;
}

/**
 * Story rail — circular highlights above the catalogue, plus the seller's own
 * «افزودن استوری» tile at the start (right edge in RTL).
 *
 * Tapping a circle opens a real full-screen vertical viewer: a dark 9:16
 * theatre with segmented progress, auto-advance, next/prev tap zones, a
 * mute toggle for clips, the seller header and a bottom «مشاهده آگهی» CTA.
 *
 * Stories are free for every signed-in member during the launch period.
 */
export function Stories({ stories, label = 'داستان‌های آگهی' }: { stories: StoryItem[]; label?: string }) {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [mine, setMine] = useState<StoryListingOption[]>([]);
  const [created, setCreated] = useState<StoryItem[]>([]);
  const [draft, setDraft] = useState<StoryDraft | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const gallery = useGalleryPicker();

  const loadStories = useCallback(async () => {
    try {
      const res = await fetch('/api/stories');
      if (!res.ok) return;
      const body = (await res.json()) as {
        stories?: Array<{
          id: string;
          title: string;
          mediaUrl: string;
          mediaKind: 'image' | 'video';
          listingSlug: string | null;
          authorId: string;
          authorProfilePublic: boolean;
        }>;
        mine?: StoryListingOption[];
      };
      setMine(body.mine ?? []);
      setCreated(
        (body.stories ?? []).map((story) => ({
          slug: `story-${story.id}`,
          title: story.title,
          coverUrl: story.mediaUrl,
          href: story.listingSlug
            ? `/listing/${story.listingSlug}`
            : story.authorProfilePublic
              ? `/seller/${story.authorId}`
              : '/',
          ...(story.mediaKind === 'video' ? { videoUrl: story.mediaUrl } : {}),
        })),
      );
    } catch {
      // stories are an enhancement; a failed fetch leaves the seeded rail
    }
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { user?: { id?: string; displayName?: string | null } } | null) => {
        if (alive && body?.user) {
          setDisplayName(body.user.displayName ?? '');
        }
      })
      .catch(() => undefined);
    void loadStories();
    return () => {
      alive = false;
    };
  }, [loadStories]);

  const rail = [...created, ...stories];

  const openAdd = () => {
    gallery.request(() => mediaInput.current?.click());
  };

  const draftPicked = async (file: File | undefined) => {
    if (!file) return;
    setPickerError(null);
    try {
      const processed = await processListingMedia(file);
      if (!processed.blob) throw new Error(t('خواندن رسانه ممکن نشد.', 'Could not read that media.'));
      setDraft({
        previewUrl: processed.previewUrl,
        kind: processed.kind,
        blob: processed.blob,
        mime: processed.mime,
        width: processed.width,
        height: processed.height,
      });
      setComposerOpen(true);
    } catch (err) {
      setPickerError(
        err instanceof Error ? err.message : t('خواندن رسانه ممکن نشد.', 'Could not read that media.'),
      );
    }
  };

  const clearDraft = () => {
    setComposerOpen(false);
    setDraft((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  };

  return (
    <section aria-label={t(label)} className="rounded-card border border-line bg-card p-3 sm:p-4">
      <ul
        aria-label={t(label)}
        className="flex snap-x snap-mandatory items-start gap-3 overflow-x-auto overflow-y-visible px-0.5 py-2.5 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <AddStoryTile displayName={displayName} onClick={openAdd} />
        {rail.map((story, index) => (
          <StoryTile key={story.slug} story={story} onOpen={() => setOpenIndex(index)} />
        ))}
      </ul>

      <input
        ref={mediaInput}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        hidden
        onChange={(event) => {
          void draftPicked(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      {pickerError && <p className="mt-1 px-1 text-xs font-bold text-red-600">{pickerError}</p>}
      <GalleryPermissionDialog
        open={gallery.pending}
        onAllow={gallery.allow}
        onCancel={gallery.cancel}
      />

      {composerOpen && draft && (
        <StoryComposer
          listings={mine}
          displayName={displayName}
          media={draft}
          onClose={clearDraft}
          onPublished={() => {
            clearDraft();
            void loadStories();
          }}
        />
      )}

      {openIndex !== null && rail[openIndex] && (
        <StoryViewer
          stories={rail}
          startIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </section>
  );
}

export interface StoryListingOption {
  slug: string;
  title: string;
  coverUrl: string | null;
}

interface StoryDraft {
  /** Local object URL used only for the composer preview. */
  previewUrl: string;
  kind: 'image' | 'video';
  blob: Blob;
  mime: string;
  width: number;
  height: number;
}

/** Circular «+» entry point: avatar (or initial) with an orange plus badge. */
function AddStoryTile({
  displayName,
  onClick,
}: {
  displayName: string | null;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const initial = displayName?.trim().charAt(0) || null;
  return (
    <li className="shrink-0 snap-start">
      <button
        type="button"
        onClick={onClick}
        className="flex w-[80px] flex-col items-center gap-1.5 transition active:scale-95"
      >
        <span className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-dashed border-line-strong bg-page">
          {initial ? (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cta-soft text-lg font-extrabold text-ink">
              {initial}
            </span>
          ) : (
            <Icon name="user" size={26} className="text-muted" />
          )}
          <span className="absolute -bottom-0.5 -start-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[color:var(--color-surface)] bg-[#F98513] text-white">
            <Icon name="plus" size={14} />
          </span>
        </span>
        <span className="w-full truncate text-center text-[11px] font-extrabold leading-tight text-ink">
          {t('افزودن استوری', 'Add Story')}
        </span>
      </button>
    </li>
  );
}

/**
 * Free-launch story composer.
 *
 * Any signed-in user can publish a vertical photo/clip or a story for one of
 * their own listings, immediately and for free. When the owner flips the paid
 * guard in /admin the same tile opens the plan modal instead — the switch is
 * the only difference, no second code path.
 */
function StoryComposer({
  listings,
  displayName,
  media,
  onClose,
  onPublished,
}: {
  listings: StoryListingOption[];
  displayName: string | null;
  media: StoryDraft;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { t } = useI18n();
  const [target, setTarget] = useState<'listing' | 'profile'>(
    listings.length > 0 ? 'listing' : 'profile',
  );
  const [listingSlug, setListingSlug] = useState(listings[0]?.slug ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const picked = listings.find((item) => item.slug === listingSlug) ?? null;

  const publish = async () => {
    if (busy) return;
    if (target === 'listing' && !listingSlug) {
      setError(t('یکی از آگهی‌هایتان را انتخاب کنید.', 'Choose one of your listings.'));
      return;
    }
    setBusy(true);
    setError(null);
    let uploadedUrl: string | null = null;
    try {
      const form = new FormData();
      form.append(
        'file',
        new File([media.blob], `story.${mediaExtension(media.mime)}`, { type: media.mime }),
      );
      form.append('width', String(media.width));
      form.append('height', String(media.height));
      const upload = await fetch('/api/media/story', { method: 'POST', body: form });
      const uploaded = (await upload.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!upload.ok || !uploaded.url) {
        setError(uploaded.error ?? t('بارگذاری رسانه انجام نشد.', 'Could not upload the media.'));
        return;
      }
      uploadedUrl = uploaded.url;

      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mediaUrl: uploaded.url,
          mediaKind: media.kind,
          listingSlug: target === 'listing' ? listingSlug : null,
          title:
            target === 'listing'
              ? (picked?.title ?? displayName ?? 'استوری Ali Sales')
              : (displayName ?? 'استوری Ali Sales'),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        // The story row failed; remove the just-uploaded object instead of
        // leaving an orphan in the story bucket.
        void fetch('/api/media', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: uploaded.url }),
        });
        setError(body.error ?? t('ثبت استوری انجام نشد.', 'Could not publish the story.'));
        return;
      }
      onPublished();
    } catch {
      if (uploadedUrl) {
        void fetch('/api/media', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: uploadedUrl }),
        });
      }
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not connect to the server.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('ثبت استوری', 'Publish a story')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-card border border-line bg-card p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cta-soft text-cta">
            <Icon name="camera" size={20} />
          </span>
          <h2 className="text-sm font-extrabold text-ink">{t('انتشار استوری', 'Publish a story')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('بستن', 'Close')}
            className="ms-auto flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-cta-soft hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="mt-3 flex gap-3">
          <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-sunken">
            {media.kind === 'video' ? (
              <video src={media.previewUrl} muted loop autoPlay playsInline className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.previewUrl} alt={t('پیش‌نمایش استوری', 'Story preview')} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-ink">{t('مقصد استوری', 'Story destination')}</p>
            <div className="mt-2 grid gap-2">
              <button
                type="button"
                onClick={() => setTarget('listing')}
                disabled={listings.length === 0}
                aria-pressed={target === 'listing'}
                className={`rounded-xl border p-2.5 text-start text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  target === 'listing' ? 'border-cta bg-cta-soft' : 'border-line bg-page/60'
                }`}
              >
                <span className="block font-extrabold text-ink">{t('۱. انتقال به آگهی من', '1. Link to my listing')}</span>
                <span className="mt-0.5 block text-[10px] text-muted">{t('لینک به یکی از آگهی‌ها', 'Link to one of your listings')}</span>
              </button>
              <button
                type="button"
                onClick={() => setTarget('profile')}
                aria-pressed={target === 'profile'}
                className={`rounded-xl border p-2.5 text-start text-xs transition ${
                  target === 'profile' ? 'border-cta bg-cta-soft' : 'border-line bg-page/60'
                }`}
              >
                <span className="block font-extrabold text-ink">{t('۲. انتقال به پروفایل من', '2. Link to my profile')}</span>
                <span className="mt-0.5 block text-[10px] text-muted">{t('نمایش پروفایل/صفحه من', 'Show my profile page')}</span>
              </button>
            </div>
          </div>
        </div>

        {target === 'listing' && listings.length > 0 && (
          <div className="mt-3">
            <span className="label mb-0">{t('آگهی مرتبط', 'Related listing')}</span>
            <CustomSelect
              value={listingSlug}
              onChange={setListingSlug}
              ariaLabel={t('آگهی مرتبط', 'Related listing')}
              options={listings.map((item) => ({ value: item.slug, label: item.title }))}
            />
          </div>
        )}

        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void publish()}
          disabled={busy}
          className="btn-cta mt-4 w-full text-sm disabled:opacity-60"
        >
          {busy ? t('در حال ثبت…', 'Publishing...') : t('انتشار استوری', 'Publish story')}
        </button>
      </div>
    </div>
  );
}

/** One 72px circle: gradient ring, photo, one-line label. */
function StoryTile({ story, onOpen }: { story: StoryItem; onOpen: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const accent = emblemInk(story.brand);

  return (
    <li className="shrink-0 snap-start">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-[80px] flex-col items-center gap-1.5 transition active:scale-95"
      >
        <span
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full p-[2.5px] transition hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${accent}, #F98513)` }}
        >
          <span className="relative h-full w-full overflow-hidden rounded-full border-2 border-[color:var(--color-surface)] bg-sunken">
            {!loaded && (
              <span
                aria-hidden
                className="absolute inset-0 animate-pulse bg-gradient-to-br from-line to-sunken"
              />
            )}
            <Image
              src={story.coverUrl}
              alt={story.title}
              fill
              sizes="72px"
              unoptimized={isPreSizedSource(story.coverUrl)}
              onLoad={() => setLoaded(true)}
              className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
            {story.videoUrl && (
              <span className="absolute bottom-1 end-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white">
                <Icon name="camera" size={11} />
              </span>
            )}
          </span>
        </span>
        <span className="w-full truncate text-center text-[11px] font-bold leading-tight text-muted">
          {story.title}
        </span>
      </button>
    </li>
  );
}

/** Skeleton rail for a loading category page (same geometry as the real one). */
export function StoriesSkeleton({ count = 6 }: { count?: number }) {
  return (
    <section aria-hidden className="rounded-card border border-line bg-card p-3 sm:p-4">
      <ul className="flex items-start gap-3 overflow-hidden">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="flex w-[80px] shrink-0 flex-col items-center gap-1.5">
            <span className="h-[72px] w-[72px] animate-pulse rounded-full bg-line" />
            <span className="h-2.5 w-14 animate-pulse rounded bg-line" />
          </li>
        ))}
      </ul>
    </section>
  );
}
