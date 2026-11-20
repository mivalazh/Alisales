'use client';

/**
 * Automotive tire loader.
 *
 * A bold navy tire with a treaded sidewall and a five-spoke alloy spins while
 * «LOADING» stays crisp and upright in the middle of the hub. The mark is
 * drawn inline so it appears without waiting for an image, and it is
 * decorative: the status label carries the meaning for screen readers.
 *
 * By default it paints as a viewport-centred overlay (`fixed inset-0`, soft
 * scrim, non-interactive), so it never lands inside a stories rail or a
 * button's text. Callers that genuinely need it inside a control pass
 * `inline`. Every caller gates it behind `useDelayedBusy`, so a request that
 * resolves inside 300ms never flashes the wheel.
 */
const SIZES = {
  sm: 'h-10 w-10',
  md: 'h-20 w-20',
  lg: 'h-28 w-28',
} as const;

const TREAD_BLOCKS = Array.from({ length: 28 }, (_, index) => index * (360 / 28));
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
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${box}`}
      role="status"
      aria-label={label}
    >
      <svg viewBox="0 0 100 100" className={`${box} block`} aria-hidden="true" focusable="false">
        {/* Only the wheel rotates; the wordmark is HTML on top and stays upright. */}
        <g className="car-tire">
          <circle cx="50" cy="50" r="47" fill="#111144" />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="#F98513"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
          {TREAD_BLOCKS.map((angle) => (
            <rect
              key={angle}
              x="48.4"
              y="1.2"
              width="3.2"
              height="5.6"
              rx="1.2"
              fill="#223382"
              transform={`rotate(${angle} 50 50)`}
            />
          ))}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="#F98513"
            strokeOpacity="0.8"
            strokeWidth="1.4"
          />
          <circle cx="50" cy="50" r="33" fill="#0B0B33" />
          {SPOKES.map((angle) => (
            <path
              key={angle}
              d="M47 50 L42.5 18.5 Q50 13.8 57.5 18.5 L53 50 Z"
              fill="#DCE3EE"
              fillOpacity="0.94"
              transform={`rotate(${angle} 50 50)`}
            />
          ))}
          <circle
            cx="50"
            cy="50"
            r="20"
            fill="#111144"
            stroke="#F98513"
            strokeOpacity="0.7"
            strokeWidth="1.2"
          />
        </g>
      </svg>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span
          className="text-[10px] font-black tracking-wider text-[#F98513]"
          style={{ textShadow: '0 0 3px #111144, 0 0 3px #111144' }}
        >
          LOADING
        </span>
      </span>
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
