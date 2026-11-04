'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Icon } from './Icon';
import { isPreSizedSource } from '@/lib/images';

export interface StoryItem {
  slug: string;
  title: string;
  coverUrl: string;
  href: string;
}

/**
 * Story rail — the circular approved listing highlights above the catalogue,
 * with the Habañero ring and a full-screen viewer. Tapping a ring opens the
 * viewer; its «مشاهده‌ی آگهی» link carries the buyer to the listing.
 */
export function Stories({ stories, label = 'داستان‌های آگهی' }: { stories: StoryItem[]; label?: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const active = openIndex === null ? null : (stories[openIndex] ?? null);

  if (stories.length === 0) return null;

  return (
    <section aria-label={label} className="rounded-card border border-line bg-card p-3">
      <ul dir="ltr" className="flex items-start gap-3 overflow-x-auto pb-1">
        {stories.map((story, index) => (
          <li key={story.slug} className="shrink-0">
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              className="flex w-20 flex-col items-center gap-1.5"
            >
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full p-[3px]"
                style={{ background: 'linear-gradient(135deg, #F98513, #ffb457)' }}
              >
                <span className="relative h-full w-full overflow-hidden rounded-full border-2 border-[color:var(--color-surface)] bg-sunken">
                  <Image
                    src={story.coverUrl}
                    alt={story.title}
                    fill
                    sizes="64px"
                    unoptimized={isPreSizedSource(story.coverUrl)}
                    className="object-cover"
                  />
                </span>
              </span>
              <span className="line-clamp-2 text-center text-[11px] font-bold leading-tight text-muted">
                {story.title}
              </span>
            </button>
          </li>
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
