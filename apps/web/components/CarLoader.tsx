'use client';

import { useId } from 'react';

/**
 * Automotive tire loader.
 *
 * A compact alloy wheel — tyre wall with tread blocks, outer and inner rim
 * lips, five sculpted sport spokes in a metallic orange gradient, an asymmetric
 * valve stem and a lug-nut hub — with «LOADING» arched tightly over its crown.
 *
 * The word is drawn outside the rotating group, so it never spins or blurs. The
 * arch path is deliberately shallow and sits on the tyre's top edge: the gap
 * between the letters and the rubber is what made the earlier lockup read as two
 * unrelated pieces, so there is none left to see.
 *
 * The rotation lives on a plain HTML wrapper (`animate-[spin_1.1s_linear_infinite]`)
 * rather than on the SVG group: CSS transforms on an SVG `<g>` are ignored by
 * some desktop Chrome / WebKit builds, while a block-level div always animates.
 *
 * Everything is inline SVG: it appears without waiting for an image, and it is
 * decorative, because the status label carries the meaning for screen readers.
 *
 * By default it paints as a viewport-centred overlay (`fixed inset-0`, soft
 * scrim, non-interactive), so it never lands inside a stories rail or a
 * button's text. Callers that genuinely need it inside a control pass `inline`,
 * and the wheel then sits on the optical centre of the overlay because the arch
 * is absolutely positioned above it.
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
/** Twenty tread blocks around the tyre wall. */
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
  // One arc/metal id pair per instance: two overlays on a page must not share.
  const unique = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const arcId = `car-loading-arc-${unique}`;
  const metalId = `car-loading-metal-${unique}`;

  const wheel = (
    <span className="relative inline-flex shrink-0 items-center justify-center" role="status">
      {/* Arched wordmark: outside the rotating group, sitting directly on the
          tyre crown. The viewBox hugs the arc itself (x 8–80, y 8–48), and the
          negative bottom margin removes the last few pixels of descender space
          so the letters touch the rubber instead of floating above it. */}
      {!inline && (
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="8 10 72 38"
          className="absolute bottom-full left-1/2 -mb-1 h-[38px] w-[72px] -translate-x-1/2 overflow-visible"
        >
          <defs>
            <path id={arcId} d="M 13,46 A 32,32 0 0,1 75,46" fill="none" />
          </defs>
          <text
            fill="#F98513"
            fontSize="12.5"
            fontWeight="900"
            letterSpacing="1.2"
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
          <defs>
            {/* Metallic alloy: a bright top edge falling to a deep orange base,
                so the five spokes read as machined faces rather than flat bars. */}
            <linearGradient id={metalId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFC98A" />
              <stop offset="0.42" stopColor="#F98513" />
              <stop offset="1" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <g>
            {/* Tyre wall: the rubber, then the tread blocks cut across it. */}
            <circle cx="50" cy="50" r="45" fill="none" stroke="#C05A05" strokeWidth="9.5" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="#F98513" strokeWidth="6.5" />
            {TREAD.map((angle, index) => (
              <rect
                key={`tread-${angle}`}
                x="47.4"
                y="5.9"
                width="5.2"
                height={index % 2 === 0 ? 6.4 : 4.6}
                rx="1.1"
                fill="#B45309"
                fillOpacity={index % 2 === 0 ? 0.85 : 0}
                stroke="#B45309"
                strokeWidth="1.4"
                strokeOpacity="0.7"
                transform={`rotate(${angle} 50 50)`}
              />
            ))}
            {/* Outer rim lip, inner bead line and a thin highlight arc. */}
            <circle cx="50" cy="50" r="36.6" fill="none" stroke="#B45309" strokeWidth="2.8" />
            <circle cx="50" cy="50" r="36.6" fill="none" stroke="#F98513" strokeWidth="1.5" />
            <circle
              cx="50"
              cy="50"
              r="32.4"
              fill="none"
              stroke="#F98513"
              strokeWidth="1.1"
              strokeOpacity="0.45"
            />
            {/* Five sculpted sport spokes: narrow at the rim, flared at the hub,
                filled with the metal gradient and edged for contrast. */}
            {SPOKES.map((angle) => (
              <path
                key={`spoke-${angle}`}
                d="M 45.8,18.2 L 43.6,36.2 L 56.4,36.2 L 54.2,18.2 Z"
                fill={`url(#${metalId})`}
                stroke="#B45309"
                strokeWidth="0.7"
                strokeOpacity="0.55"
                transform={`rotate(${angle} 50 50)`}
              />
            ))}
            {/* Hub ring, then the lug nuts. One nut is a square so the eye can
                follow the spin, and the valve stem breaks the circle too. */}
            <circle cx="50" cy="50" r="13" fill="none" stroke="#B45309" strokeWidth="6.6" />
            <circle cx="50" cy="50" r="13" fill="none" stroke="#F98513" strokeWidth="4.6" />
            {LUGS.map((angle, index) =>
              index === 0 ? (
                <rect
                  key={`lug-${angle}`}
                  x="47.7"
                  y="40.7"
                  width="4.6"
                  height="4.6"
                  rx="0.6"
                  fill="#FFD9AE"
                  transform={`rotate(${angle} 50 50)`}
                />
              ) : (
                <circle
                  key={`lug-${angle}`}
                  cx="50"
                  cy="43"
                  r="2.3"
                  fill="#C05A05"
                  transform={`rotate(${angle} 50 50)`}
                />
              ),
            )}
            {/* Valve stem: a small stalk at the rim, deliberately off-centre. */}
            <rect x="48.6" y="10.4" width="2.8" height="7.2" rx="1.4" fill="#FFD9AE" />
            <circle cx="50" cy="50" r="4.6" fill="#FFC98A" />
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
