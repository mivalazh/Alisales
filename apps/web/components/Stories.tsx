'use client';

import Image from 'next/image';
import { useState } from 'react';
import { emblemInk } from './BrandEmblem';
import { Icon } from './Icon';
import { isPreSizedSource } from '@/lib/images';

export interface StoryItem {
  slug: string;
  title: string;
  coverUrl: string;
  href: string;
  /** Marque slug — the ring takes its accent colour. */
  brand?: string;
}

/**
 * Story rail — circular listing highlights above the catalogue.
 *
 * Polished to a single consistent 72px circle: a gradient ring in the brand
 * colour, the photo centred inside it, and the title under it truncated to one
 * line. The rail snaps horizontally, tiles scale slightly on hover/press, and
 * each photo fades in from a shimmer placeholder instead of popping in, so a
 * slow image never shows a mismatched crop.
 */
export function Stories({ stories, label = 'داستان‌های آگهی' }: { stories: StoryItem[]; label?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const active = openIndex === null ? null : (stories[openIndex] ?? null);

  if (stories.length === 0) return null;

  return (
    <section aria-label={label} className="rounded-card border border-line bg-card p-3 sm:p-4">
      <ul
        aria-label={label}
        className="flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-0.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stories.map((story, index) => (
          <StoryTile key={story.slug} story={story} onOpen={() => setOpenIndex(index)} />
        ))}
      </ul>

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpenIndex(null)}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-card border border-line bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[var(--photo-aspect)] bg-sunken">
              <Image
                src={active.coverUrl}
                alt={active.title}
                fill
                sizes="(min-width: 640px) 384px, 100vw"
                unoptimized={isPreSizedSource(active.coverUrl)}
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => setOpenIndex(null)}
                aria-label="بستن"
                className="absolute end-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm font-extrabold text-ink">{active.title}</p>
              <a href={active.href} className="btn-cta w-full text-sm">
                مشاهده‌ی آگهی
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
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
          className="flex h-[72px] w-[72px] items-center justify-center rounded-full p-[2.5px] transition group-hover:scale-[1.03] hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${accent}, #F98513)` }}
        >
          <span className="relative h-full w-full overflow-hidden rounded-full border-2 border-[color:var(--color-surface)] bg-sunken">
            {/* Shimmer placeholder: the exact same circle, so no crop jump. */}
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
    <section
      aria-hidden
      className="rounded-card border border-line bg-card p-3 sm:p-4"
    >
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
