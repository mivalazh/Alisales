'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { Icon } from './Icon';
import { isPreSizedSource } from '@/lib/images';

/** Clips are stored with their own extension; the gallery treats them as video. */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

/**
 * Detail-page gallery: one hero frame with next/prev arrows, a thumbnail strip
 * that jumps to a photo, and horizontal swipe on touch devices. The hero keeps
 * the compact 16:10 frame and the 420px cap from the desktop layout; sold
 * listings stay desaturated.
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
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const count = photos.length;
  const current = photos[Math.min(index, Math.max(count - 1, 0))] ?? null;

  const go = (step: number) => setIndex((i) => (i + step + count) % count);

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
            <span className="text-sm">بدون عکس</span>
          </div>
        )}

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="عکس قبلی"
              className="absolute start-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111144] shadow-md transition hover:bg-white"
            >
              <Icon name="chevronRight" size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="عکس بعدی"
              className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#111144] shadow-md transition hover:bg-white"
            >
              <Icon name="chevronLeft" size={18} />
            </button>
            <span className="absolute bottom-2 end-2 rounded-full bg-[#111144]/75 px-2 py-0.5 text-[11px] font-bold text-white">
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
                aria-label={`نمایش عکس ${i + 1}`}
                aria-pressed={i === index}
                className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl border bg-sunken transition ${
                  i === index ? 'border-cta ring-1 ring-cta' : 'border-line hover:border-line-strong'
                }`}
              >
                {isVideoUrl(url) ? (
                  <>
                    <video src={url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                      <Icon name="grid" size={16} />
                    </span>
                  </>
                ) : (
                  <Image
                    src={url}
                    alt={`${alt} — عکس ${i + 1}`}
                    fill
                    sizes="(min-width: 1024px) 14vw, 25vw"
                    unoptimized={isPreSizedSource(url)}
                    className="object-cover"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
