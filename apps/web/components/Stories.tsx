'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emblemInk } from './BrandEmblem';
import { CustomSelect } from './CustomSelect';
import { GalleryPermissionDialog, useGalleryPicker } from './GalleryPermission';
import { Icon } from './Icon';
import { isPreSizedSource } from '@/lib/images';
import { storyImageFallback } from '@/lib/story-images';
import { mediaExtension } from '@/lib/media-rules';
import { processStoryMedia } from '@/lib/photos';
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
      const processed = await processStoryMedia(file);
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
        <AddStoryTile onClick={openAdd} />
        {rail.map((story, index) => (
          <StoryTile key={story.slug} story={story} onOpen={() => setOpenIndex(index)} />
        ))}
      </ul>

      <input
        ref={mediaInput}
        type="file"
        accept="image/*,image/heic,image/heif,video/*"
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

/**
 * Unified «افزودن استوری» entry point.
 *
 * Every browse page shares this single tile: a dashed gradient ring around a
 * camera-plus glyph, with the orange plus badge on the lower corner. It never
 * falls back to an initial letter or a silhouette.
 */
function AddStoryTile({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <li className="shrink-0 snap-start">
      <button
        type="button"
        onClick={onClick}
        aria-label={t('افزودن استوری', 'Add Story')}
        className="flex w-[80px] flex-col items-center gap-1.5 transition active:scale-95"
      >
        <span
          className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full p-[2.5px]"
          style={{ background: 'linear-gradient(135deg, #111144 0%, #F98513 100%)' }}
        >
          <span className="flex h-full w-full items-center justify-center rounded-full border-2 border-dashed border-white/75 bg-page text-ink dark:border-white/35">
            <Icon name="cameraPlus" size={27} className="text-[#111144] dark:text-white" />
          </span>
          <span className="absolute -bottom-0.5 -start-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[color:var(--color-surface)] bg-[#F98513] text-white shadow-sm">
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
  // The story header already links to the poster's profile, so a destination
  // choice is not needed: the only optional decision is which of the seller's
  // own listings the story is attached to.
  const [linkListing, setLinkListing] = useState(listings.length > 0);
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
    if (linkListing && !listingSlug) {
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
      // The bytes left the canvas as a ≤1080px / 0.8 JPEG (a few hundred KB),
      // so a slow LTE request finishes well inside this budget. A request that
      // does not answer is reported as a timeout, not left spinning.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60_000);
      let upload: Response;
      try {
        upload = await fetch('/api/media/story', {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });
      } catch (err) {
        setError(
          err instanceof DOMException && err.name === 'AbortError'
            ? t(
                'بارگذاری استوری بیش از حد طول کشید؛ اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.',
                'The story upload timed out; check your connection and try again.',
              )
            : t(
                `ارتباط با سرور برقرار نشد: ${err instanceof Error ? err.message : String(err)}`,
                `Could not reach the server: ${err instanceof Error ? err.message : String(err)}`,
              ),
        );
        return;
      } finally {
        clearTimeout(timer);
      }
      // Read the body as text first: an edge refusal (413) is plain text, not
      // JSON, and discarding it is what turned every failure into a generic
      // message. The modal shows the status and the server's own words.
      const raw = await upload.text().catch(() => '');
      let uploaded: { url?: string; error?: string } = {};
      try {
        uploaded = JSON.parse(raw) as { url?: string; error?: string };
      } catch {
        // Not JSON: `raw` already holds the server/proxy message.
      }
      if (!upload.ok || !uploaded.url) {
        const serverText =
          uploaded.error?.trim() ||
          raw
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 240);
        setError(
          t(
            `بارگذاری رسانه ناموفق بود (HTTP ${upload.status})${serverText ? `: ${serverText}` : ''}`,
            `Media upload failed (HTTP ${upload.status})${serverText ? `: ${serverText}` : ''}`,
          ),
        );
        return;
      }
      uploadedUrl = uploaded.url;

      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mediaUrl: uploaded.url,
          mediaKind: media.kind,
          listingSlug: linkListing ? listingSlug : null,
          title: linkListing
            ? (picked?.title ?? displayName ?? 'استوری Ali Sales')
            : (displayName ?? 'استوری Ali Sales'),
        }),
      });
      const rawStory = await res.text().catch(() => '');
      let body: { ok?: boolean; error?: string } = {};
      try {
        body = JSON.parse(rawStory) as { ok?: boolean; error?: string };
      } catch {
        // Not JSON: keep the raw text as the server's message.
      }
      if (!res.ok) {
        // The story row failed; remove the just-uploaded object instead of
        // leaving an orphan in the story bucket.
        void fetch('/api/media', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: uploaded.url }),
        });
        const serverText = body.error?.trim() || rawStory.trim().slice(0, 240);
        setError(
          t(
            `ثبت استوری انجام نشد (HTTP ${res.status})${serverText ? `: ${serverText}` : ''}`,
            `Could not publish the story (HTTP ${res.status})${serverText ? `: ${serverText}` : ''}`,
          ),
        );
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
            className="ms-auto flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-cta-soft hover:text-ink"
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
              <img src={media.previewUrl} alt={t('پیش‌نمایش استوری', 'Story preview')} width={320} height={448} className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold text-ink">{t('مقصد استوری', 'Story destination')}</p>
            <label
              className={`mt-2 flex cursor-pointer items-start gap-2 rounded-xl border p-2.5 text-xs transition ${
                listings.length === 0
                  ? 'cursor-not-allowed border-line bg-page/60 opacity-50'
                  : linkListing
                    ? 'border-cta bg-cta-soft'
                    : 'border-line bg-page/60'
              }`}
            >
              <input
                type="checkbox"
                checked={linkListing && listings.length > 0}
                disabled={listings.length === 0}
                onChange={(event) => setLinkListing(event.target.checked)}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                <span className="block font-extrabold text-ink">
                  {t('انتقال به آگهی من', 'Link to my listing')}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted">
                  {listings.length === 0
                    ? t('هنوز آگهی‌ای برای اتصال ندارید', 'You have no listing to link yet')
                    : t('اختیاری؛ استوری به یکی از آگهی‌های شما وصل می‌شود', 'Optional; attach the story to one of your listings')}
                </span>
              </span>
            </label>
          </div>
        </div>

        {linkListing && listings.length > 0 && (
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
  const fallback = storyImageFallback(story.slug);
  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState(story.coverUrl || fallback);
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
              src={src}
              alt={story.title}
              fill
              sizes="72px"
              referrerPolicy="no-referrer"
              unoptimized={isPreSizedSource(src)}
              onLoad={() => setLoaded(true)}
              onError={() => {
                if (src !== fallback) {
                  setLoaded(false);
                  setSrc(fallback);
                } else {
                  setLoaded(true);
                }
              }}
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
