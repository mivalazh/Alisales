'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { isPreSizedSource } from '@/lib/images';
import { useI18n } from '@/lib/i18n';

/** Clips are stored with their own extension; the gallery treats them as video. */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

/**
 * Detail-page gallery: one hero frame with next/prev arrows, a thumbnail strip
 * that jumps to a photo, horizontal swipe on touch devices, and a fullscreen
 * viewer with 2× zoom. Video slots always get native controls and play inline.
 */
export function ListingGallery({
  photos,
  alt,
  sold = false,
}: {
  photos: string[];
  alt: string;
  sold?: boolean;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const startX = useRef<number | null>(null);
  const count = photos.length;
  const current = photos[Math.min(index, Math.max(count - 1, 0))] ?? null;

  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  useEffect(() => {
    if (!viewer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewer(false);
      if (event.key === 'ArrowRight' && count > 1) go(-1);
      if (event.key === 'ArrowLeft' && count > 1) go(1);
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [viewer, count]);

  return (
    <div className="space-y-2">
      <div
        className="relative aspect-[16/10] max-h-[420px] w-full overflow-hidden rounded-2xl border border-line bg-sunken"
        onTouchStart={(e) => {
          startX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = startX.current;
          const end = e.changedTouches[0]?.clientX;
          startX.current = null;
          if (start === null || end === undefined || count < 2) return;
          const dx = end - start;
          if (Math.abs(dx) < 36) return;
          go(dx > 0 ? -1 : 1);
        }}
      >
        {current ? (
          isVideoUrl(current) ? (
            <video
              src={current}
              controls
              playsInline
              preload="metadata"
              className="h-full w-full bg-black object-contain"
            />
          ) : (
            <Image
              src={current}
              alt={alt}
              fill
              sizes="(min-width: 1024px) 58vw, 100vw"
              unoptimized={isPreSizedSource(current)}
              priority
              className={`object-cover ${sold ? 'opacity-60 grayscale' : ''}`}
            />
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-faint">
            <Icon name="camera" size={40} />
            <span className="text-sm">{t('بدون عکس', 'No photos')}</span>
          </div>
        )}

        {current && !isVideoUrl(current) && (
          <button
            type="button"
            onClick={() => {
              setZoomed(false);
              setViewer(true);
            }}
            aria-label={t('نمایش تمام‌صفحه و بزرگ‌نمایی عکس', 'Open fullscreen photo viewer')}
            className="absolute start-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#111144]/75 text-white shadow-md backdrop-blur transition hover:bg-[#111144]"
          >
            <Icon name="plus" size={17} />
          </button>
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t('عکس قبلی', 'Previous photo')}
              className="absolute start-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111144] shadow-md transition hover:bg-white"
            >
              <Icon name="chevronRight" size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t('عکس بعدی', 'Next photo')}
              className="absolute end-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111144] shadow-md transition hover:bg-white"
            >
              <Icon name="chevronLeft" size={18} />
            </button>
            <span className="absolute bottom-2 end-2 z-10 rounded-full bg-[#111144]/75 px-2 py-0.5 text-[11px] font-bold text-white">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="grid grid-cols-4 gap-2">
          {photos.slice(0, 8).map((url, i) => (
            <li key={`${url}-${i}`}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${t('نمایش عکس', 'View photo')} ${i + 1}`}
                aria-pressed={i === index}
                className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl border bg-sunken transition ${
                  i === index ? 'border-cta ring-1 ring-cta' : 'border-line hover:border-line-strong'
                }`}
              >
                {isVideoUrl(url) ? (
                  <>
                    <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                      <Icon name="camera" size={16} />
                    </span>
                  </>
                ) : (
                  <Image
                    src={url}
                    alt={`${alt} — ${t('عکس', 'photo')} ${i + 1}`}
                    fill
                    sizes="(min-width: 1024px) 14vw, 25vw"
                    unoptimized={isPreSizedSource(url)}
                    loading="lazy"
                    decoding="async"
                    className="object-cover"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {viewer && current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('نمایش عکس', 'Photo viewer')}
          className="fixed inset-0 z-[70] flex flex-col bg-black/95"
          onClick={() => setViewer(false)}
        >
          <div className="flex shrink-0 items-center justify-between px-3 py-2 text-white">
            <span className="text-xs font-bold" dir="ltr">{index + 1} / {count}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setZoomed((value) => !value);
                }}
                className="rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-bold"
              >
                {zoomed ? t('بزرگ‌نمایی کمتر', 'Zoom out') : t('بزرگ‌نمایی ۲×', 'Zoom 2×')}
              </button>
              <button
                type="button"
                onClick={() => setViewer(false)}
                aria-label={t('بستن', 'Close')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white"
              >
                <Icon name="close" size={17} />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3" onClick={(event) => event.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current}
              alt={alt}
              onClick={() => setZoomed((value) => !value)}
              className={`max-h-full max-w-full cursor-zoom-in object-contain transition-transform duration-300 ${zoomed ? 'scale-[2] cursor-zoom-out' : 'scale-100'}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
