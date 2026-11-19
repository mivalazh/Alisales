'use client';

/**
 * Centered tire loader.
 *
 * One confident orange (#F98513) line drawing: a sport tire with a tread band
 * spins while the word «LOADING» sits still and upright in the middle of the
 * wheel. Nothing else moves, no dots, no arc — the mark reads at a glance on a
 * phone and never shifts the layout it replaces.
 *
 * Decorative only: the status label stays available to assistive technology.
 * Callers gate this behind `useDelayedBusy`, so a fetch that resolves inside
 * 250ms never shows a flash of the wheel.
 */
export function CarLoader({
  size = 'md',
  label = 'loading',
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  const box = size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-36 w-36' : 'h-28 w-28';

  return (
    <span
      className={`car-loader inline-flex items-center justify-center text-[#F98513] ${box}`}
      role="status"
      aria-label={label}
    >
      <svg viewBox="0 0 140 140" className={`${box} text-[#F98513]`} aria-hidden="true">
        {/* Only the tire rotates — the label below stays upright. */}
        <g className="car-tire">
          <circle
            cx="70"
            cy="70"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="5.5"
            strokeOpacity=".92"
          />
          <circle
            cx="70"
            cy="70"
            r="41.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="4.4 7.3"
            strokeLinecap="round"
            strokeOpacity=".55"
          />
        </g>

        {/* Quiet inner rim that frames the word without competing with it. */}
        <circle
          cx="70"
          cy="70"
          r="23"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeOpacity=".35"
        />

        <text
          x="70"
          y="70"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#F98513"
          fontSize="11.5"
          fontWeight="800"
          letterSpacing="0.9"
          className="font-black"
        >
          LOADING
        </text>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
