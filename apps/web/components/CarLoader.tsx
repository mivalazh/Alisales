'use client';

/**
 * Automotive tire loader.
 *
 * A compact alloy wheel: a clean orange tire ring, a five-spoke rim and a hub,
 * with crisp uppercase «LOADING» sitting above it. The word is HTML, so it
 * never rotates with the wheel and never blurs. The mark is drawn inline so it
 * appears without waiting for an image, and it is decorative: the status label
 * carries the meaning for screen readers.
 *
 * By default it paints as a viewport-centred overlay (`fixed inset-0`, soft
 * scrim, non-interactive), so it never lands inside a stories rail or a
 * button's text. Callers that genuinely need it inside a control pass
 * `inline`. The wordmark is absolutely positioned above the wheel, so the
 * wheel itself stays on the optical centre of the overlay.
 *
 * The wordmark needs a surface of its own, so only the scrimmed overlay draws
 * it: there it sits on the dimmed page. Anywhere the wheel shares the page with
 * live content — beside a button's «در حال ارسال…», inside the notification or
 * ticket panel, or over the catalogue's results while they update — an
 * absolutely positioned word would float over that content, so those callers
 * get the mark alone and leave the wording to the surrounding UI.
 *
 * Every caller gates it behind `useDelayedBusy`, so a request that resolves
 * inside 300ms never flashes the wheel.
 */
const SIZES = {
  sm: 'h-6 w-6',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
} as const;

const SPOKES = Array.from({ length: 5 }, (_, index) => index * 72);

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

  const wheel = (
    <span className="relative inline-flex shrink-0 items-center justify-center" role="status">
      {/* Above the wheel, never inside the rotating artwork. Overlay only. */}
      {!inline && (
        <span
          aria-hidden="true"
          className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.2em] text-[#F98513]"
        >
          LOADING
        </span>
      )}
      <svg viewBox="0 0 100 100" className={`${box} block`} aria-hidden="true" focusable="false">
        <g className="car-tire">
          {/* Tire wall: one clean ring, no tread teeth. */}
          <circle cx="50" cy="50" r="45" fill="none" stroke="#F98513" strokeWidth="9" />
          {/* Rim lip. */}
          <circle
            cx="50"
            cy="50"
            r="33"
            fill="none"
            stroke="#F98513"
            strokeWidth="2.5"
            strokeOpacity="0.5"
          />
          {/* Five-spoke alloy: straight spokes from the hub to the rim lip. */}
          {SPOKES.map((angle) => (
            <line
              key={angle}
              x1="50"
              y1="38"
              x2="50"
              y2="18"
              stroke="#F98513"
              strokeWidth="7"
              strokeLinecap="round"
              transform={`rotate(${angle} 50 50)`}
            />
          ))}
          {/* Hub. */}
          <circle cx="50" cy="50" r="12" fill="#F98513" />
        </g>
      </svg>
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
