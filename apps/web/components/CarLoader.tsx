'use client';

import { useId } from 'react';

/**
 * Automotive tire loader.
 *
 * A compact alloy wheel — tyre wall with tread notches, outer and inner rim
 * lips, five sculpted sport spokes, an asymmetric valve stem and a lug-nut hub
 * — with «LOADING» arched tightly over it on a path. The word is drawn outside
 * the rotating group, so it never spins or blurs. The rotation lives on a plain
 * HTML wrapper (`animate-[spin_1.1s_linear_infinite]`) rather than on the SVG
 * group: CSS transforms on an SVG `<g>` are ignored by some desktop Chrome /
 * WebKit builds, while a block-level div always animates.
 *
 * Everything is inline SVG: it appears without waiting for an image, and it is
 * decorative, because the status label carries the meaning for screen readers.
 *
 * By default it paints as a viewport-centred overlay (`fixed inset-0`, soft
 * scrim, non-interactive), so it never lands inside a stories rail or a
 * button's text. Callers that genuinely need it inside a control pass
 * `inline`, and the wheel then sits on the optical centre of the overlay
 * because the arch is absolutely positioned above it.
 *
 * The wordmark needs a surface of its own, so only the scrimmed overlay draws
 * it: there it sits on the dimmed page. Anywhere the wheel shares the page with
 * live content — beside a button's «در حال ارسال…», inside the notification or
 * ticket panel, or over the catalogue's results while they update — an arched
 * word would float over that content, so those callers get the mark alone and
 * leave the wording to the surrounding UI.
 *
 * Every caller gates it behind `useDelayedBusy`, so a request that resolves
 * inside 300ms never flashes the wheel.
 */
const SIZES = {
  sm: 'h-6 w-6',
  md: 'h-12 w-12',
  lg: 'h-14 w-14',
} as const;

/** Five spokes, 72° apart. */
const SPOKES = Array.from({ length: 5 }, (_, index) => index * 72);
/** Twenty tread notches around the tyre wall. */
const TREAD = Array.from({ length: 20 }, (_, index) => index * 18);
/** Lug nuts sit on a small circle around the hub. */
const LUGS = Array.from({ length: 5 }, (_, index) => index * 72);

export function CarLoader({
  size = 'md',
  label = 'loading',
  inline = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  /** Keep the wheel in the surrounding layout instead of a fixed overlay. */
  inline?: boolean;
}) {
  const box = SIZES[size];
  // One arc path per instance: two overlays on a page must not share an id.
  const arcId = `car-loading-arc-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const wheel = (
    <span className="relative inline-flex shrink-0 items-center justify-center" role="status">
      {/* Arched wordmark: outside the rotating group, hugging the tyre's top
          edge so the lockup reads as one unit. */}
      {/* The arch hugs the arc itself (x 8–80, y 8–48): a 72:40 box, the same
          ratio as the viewBox, so nothing is letterboxed and the word keeps
          its size. */}
      {!inline && (
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="8 8 72 40"
          className="absolute bottom-full left-1/2 mb-0.5 h-[40px] w-[72px] -translate-x-1/2 overflow-visible"
        >
          <defs>
            <path id={arcId} d="M 14,44 A 30,30 0 0,1 74,44" fill="none" />
          </defs>
          <text
            fill="#F98513"
            fontSize="12"
            fontWeight="800"
            letterSpacing="1.6"
            fontFamily="inherit"
          >
            <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
              LOADING
            </textPath>
          </text>
        </svg>
      )}
      {/* The rotation is on this wrapper, not on the SVG: a transformed <g> is
          not animated reliably by every desktop engine. */}
      <div className={`${box} animate-[spin_1.1s_linear_infinite]`}>
        <svg viewBox="0 0 100 100" className="block h-full w-full" aria-hidden="true" focusable="false">
          <g>
            {/* Tyre wall. */}
            <circle cx="50" cy="50" r="45" fill="none" stroke="#F98513" strokeWidth="9" />
            {/* Tread notches cut across the rubber. */}
            {TREAD.map((angle) => (
              <line
                key={`tread-${angle}`}
                x1="50"
                y1="8.8"
                x2="50"
                y2="1.2"
                stroke="#F98513"
                strokeWidth="2.2"
                strokeOpacity="0.45"
                strokeLinecap="round"
                transform={`rotate(${angle} 50 50)`}
              />
            ))}
            {/* Outer rim lip, then the inner bead line. */}
            <circle cx="50" cy="50" r="36.5" fill="none" stroke="#F98513" strokeWidth="2.4" />
            <circle
              cx="50"
              cy="50"
              r="32.5"
              fill="none"
              stroke="#F98513"
              strokeWidth="1.2"
              strokeOpacity="0.4"
            />
            {/* Five sculpted sport spokes: narrow at the rim, flared at the hub. */}
            {SPOKES.map((angle) => (
              <path
                key={`spoke-${angle}`}
                d="M 45.6,18 L 43.4,36 L 56.6,36 L 54.4,18 Z"
                fill="#F98513"
                transform={`rotate(${angle} 50 50)`}
              />
            ))}
            {/* Hub ring, then the lug nuts. One nut is a square so the eye can
                follow the spin, and the valve stem breaks the circle too. */}
            <circle cx="50" cy="50" r="13" fill="none" stroke="#F98513" strokeWidth="5.5" />
            {LUGS.map((angle, index) =>
              index === 0 ? (
                <rect
                  key={`lug-${angle}`}
                  x="47.7"
                  y="40.7"
                  width="4.6"
                  height="4.6"
                  rx="0.6"
                  fill="#F98513"
                  transform={`rotate(${angle} 50 50)`}
                />
              ) : (
                <circle
                  key={`lug-${angle}`}
                  cx="50"
                  cy="43"
                  r="2.3"
                  fill="#F98513"
                  transform={`rotate(${angle} 50 50)`}
                />
              ),
            )}
            {/* Valve stem: a small stalk at the rim, deliberately off-centre. */}
            <rect x="48.6" y="10.6" width="2.8" height="7" rx="1.4" fill="#F98513" />
            <circle cx="50" cy="50" r="4.6" fill="#F98513" />
          </g>
        </svg>
      </div>
      {/* The one thing a screen reader gets: the caller's localized label. */}
      <span className="sr-only">{label}</span>
    </span>
  );

  if (inline) return wheel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/15 backdrop-blur-[2px] pointer-events-none">
      {wheel}
    </div>
  );
}
