'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emblemInk } from './BrandEmblem';
import { CustomSelect } from './CustomSelect';
import { Icon } from './Icon';
import { isPreSizedSource } from '@/lib/images';

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

const STORY_MS = 5200;

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
    <section aria-label={label} className="rounded-card border border-line bg-card p-3 sm:p-4">
      <ul
        aria-label={label}
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
          افزودن استوری
        </span>
      </button>
    </li>
  );
}

/** Story package guard for accounts without the plan. */
function PlanModal({ onClose }: { onClose: () => void }) {
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
      aria-label="بسته استوری"
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
          <h2 className="text-sm font-extrabold text-ink">ثبت استوری ویدیویی</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="ms-auto flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-cta-soft hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <p className="mt-3 text-xs leading-6 text-muted">
          برای ثبت استوری ویدیویی در بالای صفحه، نیاز به تهیه بسته استوری یا اشتراک نمایشگاهی
          دارید.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/support?topic=stories" className="btn-cta text-sm">
            مشاهده پلن‌ها
          </a>
          <a href="/support" className="btn-ghost text-sm">
            تماس با پشتیبانی
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
      setError('فقط عکس یا ویدیو قابل انتخاب است.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('حجم فایل باید کمتر از ۸ مگابایت باشد.');
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
      setError('یک عکس/ویدیو عمودی یا یکی از آگهی‌هایتان را انتخاب کنید.');
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
        setError(body.error ?? 'ثبت استوری انجام نشد.');
        return;
      }
      onPublished();
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ثبت استوری"
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
          <h2 className="text-sm font-extrabold text-ink">ثبت استوری رایگان</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="ms-auto flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-cta-soft hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <p className="mt-2 text-xs leading-6 text-muted">
          در طرح افتتاحیه، استوری برای همه‌ی کاربران رایگان است. یک عکس/ویدیو عمودی
          بگذارید یا استوری یکی از آگهی‌هایتان را بسازید.
        </p>

        <div className="mt-3 space-y-3">
          <div>
            <span className="label mb-0">آگهی مرتبط (اختیاری)</span>
            <CustomSelect
              value={listingSlug}
              onChange={setListingSlug}
              ariaLabel="آگهی مرتبط"
              placeholder="بدون آگهی — استوری آزاد"
              options={[
                { value: '', label: 'بدون آگهی — استوری آزاد' },
                ...listings.map((item) => ({ value: item.slug, label: item.title })),
              ]}
            />
          </div>

          <div>
            <span className="label mb-0">عکس یا ویدیو عمودی</span>
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
                  <img src={mediaUrl} alt="پیش‌نمایش استوری" className="h-full w-full object-cover" />
                )
              ) : (
                <>
                  <Icon name="plus" size={22} />
                  انتخاب فایل
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
          {busy ? 'در حال ثبت…' : 'انتشار استوری'}
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

/**
 * Full-screen vertical story theatre (9:16) with segmented progress at the top,
 * auto-advance, tap zones, mute toggle, seller header and the listing CTA.
 */
function StoryViewer({
  stories,
  startIndex,
  onClose,
}: {
  stories: StoryItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  const timer = useRef<number | null>(null);
  const active = stories[index];

  const next = useCallback(() => {
    setIndex((current) => {
      if (current + 1 >= stories.length) {
        onClose();
        return current;
      }
      return current + 1;
    });
  }, [onClose, stories.length]);

  const prev = () => setIndex((current) => Math.max(0, current - 1));

  // Auto-advance: one tick per 50ms, reset per story.
  useEffect(() => {
    setProgress(0);
    const started = Date.now();
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      const ratio = Math.min(1, (Date.now() - started) / STORY_MS);
      setProgress(ratio);
      if (ratio >= 1) next();
    }, 50);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [index, next]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') next();
      if (event.key === 'ArrowRight') prev();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [next, onClose]);

  if (!active) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={active.title}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-3"
      onClick={onClose}
    >
      <div
        className="relative flex w-[min(92vw,420px,calc(92vh*9/16))] flex-col overflow-hidden rounded-2xl bg-black"
        style={{ aspectRatio: '9 / 16' }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Progress segments — one per story. */}
        <div className="absolute inset-x-2 top-2 z-20 flex gap-1">
          {stories.map((story, i) => (
            <span key={story.slug} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
              <span
                className="block h-full bg-white transition-[width] duration-100 ease-linear"
                style={{ width: i < index ? '100%' : i === index ? `${progress * 100}%` : '0%' }}
              />
            </span>
          ))}
        </div>

        <div className="absolute inset-x-2 top-5 z-20 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-extrabold text-white">
            {active.title.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-extrabold text-white">{active.title}</p>
            <p className="text-[10px] font-bold text-white/60">استوری آگهی</p>
          </div>
          <button
            type="button"
            onClick={() => setMuted((v) => !v)}
            aria-label={muted ? 'صدا را روشن کن' : 'صدا را قطع کن'}
            className="flex h-8 items-center justify-center rounded-full bg-white/15 px-2 text-[10px] font-extrabold text-white"
          >
            {muted ? 'صدا قطع' : 'صدا روشن'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن استوری"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Media: a clip plays; otherwise the still fills the frame. */}
        {active.videoUrl ? (
          <video
            key={active.videoUrl}
            src={active.videoUrl}
            autoPlay
            playsInline
            muted={muted}
            className="h-full w-full object-cover"
          />
        ) : (
          <Image
            src={active.coverUrl}
            alt={active.title}
            fill
            sizes="420px"
            unoptimized={isPreSizedSource(active.coverUrl)}
            className="object-cover"
          />
        )}

        {/* Tap zones: right half = next (RTL), left = previous. */}
        <button
          type="button"
          aria-label="استوری بعدی"
          onClick={next}
          className="absolute inset-y-16 end-0 w-1/2"
        />
        <button
          type="button"
          aria-label="استوری قبلی"
          onClick={prev}
          className="absolute inset-y-16 start-0 w-1/2"
        />

        <div className="absolute inset-x-3 bottom-3 z-20">
          <a href={active.href} className="btn-cta w-full text-sm">
            مشاهده آگهی
          </a>
        </div>
      </div>
    </div>
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
