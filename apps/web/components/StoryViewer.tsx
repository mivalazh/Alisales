'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isPreSizedSource } from '@/lib/images';
import { useI18n } from '@/lib/i18n';
import type { StoryItem } from './Stories';
import { storyImageFallback } from '@/lib/story-images';
import { Icon } from './Icon';

const STORY_MS = 5200;

/**
 * Full-screen vertical story theatre (9:16) with segmented progress at the top,
 * auto-advance, tap zones, mute toggle, seller header and the listing CTA.
 *
 * Kept in its own module so the catalogue can load it on demand with
 * `next/dynamic`; the rail above the grid never pays for this code.
 */
export function StoryViewer({
  stories,
  startIndex,
  onClose,
}: {
  stories: StoryItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  // The frame is not painted yet: show the blurred thumbnail instead of the
  // video element's black first frame (and hold the progress bar). Keyed by
  // slug so the next story never inherits the previous one's ready state.
  const [readySlug, setReadySlug] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const active = stories[index];
  const ready = Boolean(active && readySlug === active.slug);
  const fallback = active ? storyImageFallback(active.slug) : '';
  const [imageSrc, setImageSrc] = useState(active?.coverUrl || fallback);

  // An uploaded clip stores the video URL as its cover too, so the poster is a
  // real image only when the two differ; otherwise the local fallback paints.
  const posterSrc = active?.videoUrl
    ? active.coverUrl && active.coverUrl !== active.videoUrl
      ? active.coverUrl
      : fallback
    : active?.coverUrl || fallback;

  useEffect(() => {
    setImageSrc(active?.coverUrl || fallback);
  }, [active?.coverUrl, fallback]);

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

  // A new story starts behind its thumbnail until its media reports ready.
  useEffect(() => {
    setProgress(0);
  }, [index]);

  // Auto-advance: one tick per 50ms, reset per story. Parked until the media
  // paints, so a phone on a slow connection never spends the story's five
  // seconds on a black screen.
  useEffect(() => {
    setProgress(0);
    if (!ready) return;
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
  }, [index, ready, next]);

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
            <p className="text-[10px] font-bold text-white/60">
              {t('استوری آگهی', 'Listing story')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMuted((v) => !v)}
            aria-label={muted ? t('صدا را روشن کن', 'Unmute') : t('صدا را قطع کن', 'Mute')}
            className="flex h-8 items-center justify-center rounded-full bg-white/15 px-2 text-[10px] font-extrabold text-white"
          >
            {muted ? t('صدا قطع', 'Muted') : t('صدا روشن', 'Sound on')}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('بستن استوری', 'Close story')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {!ready && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          >
            <Image
              src={posterSrc}
              alt=""
              fill
              sizes="420px"
              referrerPolicy="no-referrer"
              unoptimized={isPreSizedSource(posterSrc)}
              className="scale-105 object-cover blur-md"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-9 w-9 animate-spin rounded-full border-2 border-white/25 border-t-white" />
            </span>
          </div>
        )}

        {active.videoUrl ? (
          <video
            key={active.slug}
            src={active.videoUrl}
            autoPlay
            playsInline
            muted={muted}
            preload="auto"
            onLoadedData={() => setReadySlug(active.slug)}
            onError={() => setReadySlug(active.slug)}
            className={`h-full w-full object-cover transition-opacity duration-200 ${
              ready ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <Image
            key={active.slug}
            src={imageSrc}
            alt={active.title}
            fill
            sizes="420px"
            referrerPolicy="no-referrer"
            unoptimized={isPreSizedSource(imageSrc)}
            onLoad={() => setReadySlug(active.slug)}
            onError={() => {
              if (imageSrc !== fallback) {
                setImageSrc(fallback);
              } else {
                setReadySlug(active.slug);
              }
            }}
            className={`object-cover transition-opacity duration-200 ${
              ready ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        <button
          type="button"
          aria-label={t('استوری بعدی', 'Next story')}
          onClick={next}
          className="absolute inset-y-16 end-0 w-1/2"
        />
        <button
          type="button"
          aria-label={t('استوری قبلی', 'Previous story')}
          onClick={prev}
          className="absolute inset-y-16 start-0 w-1/2"
        />

        <div className="absolute inset-x-3 bottom-3 z-20">
          <a href={active.href} className="btn-cta w-full text-sm">
            {t('مشاهده آگهی', 'View listing')}
          </a>
        </div>
      </div>
    </div>
  );
}
