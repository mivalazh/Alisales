'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emblemInk } from './BrandEmblem';
import { CustomSelect } from './CustomSelect';
import { Icon } from './Icon';
import { isPreSizedSource } from '@/lib/images';
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
 * The add tile is plan-gated: an account without a story package or showroom
 * subscription gets the purchase modal instead of an uploader.
 */
export function Stories({ stories, label = 'داستان‌های آگهی' }: { stories: StoryItem[]; label?: string }) {
  const { t } = useI18n();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [paidGuard, setPaidGuard] = useState(false);
  const [mine, setMine] = useState<StoryListingOption[]>([]);
  const [created, setCreated] = useState<StoryItem[]>([]);

  const loadStories = useCallback(async () => {
    try {
      const res = await fetch('/api/stories');
      if (!res.ok) return;
      const body = (await res.json()) as {
        paidGuard?: boolean;
        stories?: Array<{
          id: string;
          title: string;
          mediaUrl: string;
          mediaKind: 'image' | 'video';
          listingSlug: string | null;
        }>;
        mine?: StoryListingOption[];
      };
      setPaidGuard(Boolean(body.paidGuard));
      setMine(body.mine ?? []);
      setCreated(
        (body.stories ?? []).map((story) => ({
          slug: `story-${story.id}`,
          title: story.title,
          coverUrl: story.mediaUrl,
          href: story.listingSlug ? `/listing/${story.listingSlug}` : '/',
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
      .then((body: { user?: { displayName?: string | null } } | null) => {
        if (alive && body?.user) setDisplayName(body.user.displayName ?? '');
      })
      .catch(() => undefined);
    void loadStories();
    return () => {
      alive = false;
    };
  }, [loadStories]);

  const rail = [...created, ...stories];

  const openAdd = () => {
    if (paidGuard) setPlanOpen(true);
    else setComposerOpen(true);
  };

  return (
    <section aria-label={t(label)} className="rounded-card border border-line bg-card p-3 sm:p-4">
      <ul
        aria-label={t(label)}
        className="flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <AddStoryTile displayName={displayName} onClick={openAdd} />
        {rail.map((story, index) => (
          <StoryTile key={story.slug} story={story} onOpen={() => setOpenIndex(index)} />
        ))}
      </ul>

      {planOpen && <PlanModal onClose={() => setPlanOpen(false)} />}

      {composerOpen && (
        <StoryComposer
          listings={mine}
          displayName={displayName}
          onClose={() => setComposerOpen(false)}
          onPublished={() => {
            setComposerOpen(false);
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

/** Story package guard for accounts without the plan. */
function PlanModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('بسته استوری', 'Story package')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-card border border-line bg-card p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cta-soft text-cta">
            <Icon name="sparkle" size={20} />
          </span>
          <h2 className="text-sm font-extrabold text-ink">
            {t('ثبت استوری ویدیویی', 'Publish a video story')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('بستن', 'Close')}
            className="ms-auto flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-cta-soft hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <p className="mt-3 text-xs leading-6 text-muted">
          {t(
            'برای ثبت استوری ویدیویی در بالای صفحه، نیاز به تهیه بسته استوری یا اشتراک نمایشگاهی دارید.',
            'To publish a video story at the top of the page, you need a story package or a showroom subscription.',
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/support?topic=stories" className="btn-cta text-sm">
            {t('مشاهده پلن‌ها', 'View plans')}
          </a>
          <a href="/support" className="btn-ghost text-sm">
            {t('تماس با پشتیبانی', 'Contact support')}
          </a>
        </div>
      </div>
    </div>
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
  onClose,
  onPublished,
}: {
  listings: StoryListingOption[];
  displayName: string | null;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { t } = useI18n();
  const [listingSlug, setListingSlug] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<'image' | 'video'>('image');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError(t('فقط عکس یا ویدیو قابل انتخاب است.', 'Please choose an image or a video.'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError(t('حجم فایل باید کمتر از ۸ مگابایت باشد.', 'The file must be smaller than 8 MB.'));
      return;
    }
    setError(null);
    const kind = file.type.startsWith('video/') ? 'video' : 'image';
    const reader = new FileReader();
    reader.onload = () => {
      setMediaKind(kind);
      setMediaUrl(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const publish = async () => {
    if (busy) return;
    const cover = mediaUrl ?? picked?.coverUrl ?? null;
    if (!cover) {
      setError(
        t(
          'یک عکس/ویدیو عمودی یا یکی از آگهی‌هایتان را انتخاب کنید.',
          'Choose a vertical photo/video or one of your listings.',
        ),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mediaUrl: cover,
          mediaKind: mediaUrl ? mediaKind : 'image',
          listingSlug: listingSlug || null,
          title: picked?.title ?? displayName ?? 'استوری Ali Sales',
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(body.error ?? t('ثبت استوری انجام نشد.', 'Could not publish the story.'));
        return;
      }
      onPublished();
    } catch {
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
        className="w-full max-w-sm rounded-card border border-line bg-card p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cta-soft text-cta">
            <Icon name="camera" size={20} />
          </span>
          <h2 className="text-sm font-extrabold text-ink">
            {t('ثبت استوری رایگان', 'Publish a free story')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('بستن', 'Close')}
            className="ms-auto flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-cta-soft hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <p className="mt-2 text-xs leading-6 text-muted">
          {t(
            'در طرح افتتاحیه، استوری برای همه‌ی کاربران رایگان است. یک عکس/ویدیو عمودی بگذارید یا استوری یکی از آگهی‌هایتان را بسازید.',
            'During the launch period, stories are free for every member. Upload a vertical photo or clip, or create a story for one of your listings.',
          )}
        </p>

        <div className="mt-3 space-y-3">
          <div>
            <span className="label mb-0">
              {t('آگهی مرتبط (اختیاری)', 'Related listing (optional)')}
            </span>
            <CustomSelect
              value={listingSlug}
              onChange={setListingSlug}
              ariaLabel={t('آگهی مرتبط', 'Related listing')}
              placeholder={t('بدون آگهی — استوری آزاد', 'No listing — standalone story')}
              options={[
                {
                  value: '',
                  label: t('بدون آگهی — استوری آزاد', 'No listing — standalone story'),
                },
                ...listings.map((item) => ({ value: item.slug, label: item.title })),
              ]}
            />
          </div>

          <div>
            <span className="label mb-0">
              {t('عکس یا ویدیو عمودی', 'Vertical photo or video')}
            </span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[9/16] max-h-40 w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-field border border-dashed border-line-strong bg-page text-xs font-bold text-muted transition hover:border-cta hover:text-ink"
            >
              {mediaUrl ? (
                mediaKind === 'video' ? (
                  <video src={mediaUrl} muted loop autoPlay playsInline className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl}
                    alt={t('پیش‌نمایش استوری', 'Story preview')}
                    className="h-full w-full object-cover"
                  />
                )
              ) : (
                <>
                  <Icon name="plus" size={22} />
                  {t('انتخاب فایل', 'Choose file')}
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              hidden
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
          </div>
        </div>

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
          {busy
            ? t('در حال ثبت…', 'Publishing...')
            : t('انتشار استوری', 'Publish story')}
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
