'use client';

import { useId } from 'react';

/**
 * Centered tire-and-rim loader.
 *
 * One confident orange (#F98513) line drawing: a sport tire with a five-spoke
 * alloy rim spins under a curved «LOADING...» arc that hugs the tire crown.
 * Decorative only — the status label stays available to assistive technology.
 * Callers gate this behind `useDelayedBusy`, so a fetch that resolves inside
 * 250ms never shows a flash of the wheel.
 */
export function CarLoader({
  size = 'md',
  label = 'loading...',
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  const compact = size === 'sm';
  // Every instance needs its own curve id; two loaders can share a page
  // (catalog transition + notification sheet), and a duplicate id would make
  // the second textPath resolve to the first arc.
  const curveId = `loader-curve-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <span
      className={`car-loader inline-flex items-center justify-center text-[#F98513] ${
        compact ? 'h-12 w-12' : 'w-32 sm:w-36'
      }`}
      role="status"
      aria-label={label}
    >
      <svg
        viewBox="0 0 140 140"
        className={compact ? 'h-12 w-12' : 'h-32 w-full'}
        aria-hidden="true"
      >
        {!compact && (
          <>
            <defs>
              <path id={curveId} d="M 22,72 A 48,48 0 0,1 118,72" />
            </defs>
            <text
              fill="#F98513"
              fontSize="13"
              fontWeight="800"
              letterSpacing="2.6"
              className="uppercase"
            >
              <textPath href={`#${curveId}`} startOffset="50%" textAnchor="middle">
                LOADING...
              </textPath>
            </text>
          </>
        )}

        {/* Tire, tread ticks and rim share one rotating group. */}
        <g className="car-tire">
          {/* Tire wall + tread band. */}
          <circle
            cx="70"
            cy="72"
            r="37"
            fill="none"
            stroke="#F98513"
            strokeWidth="5"
            strokeOpacity=".9"
          />
          <circle
            cx="70"
            cy="72"
            r="41.5"
            fill="none"
            stroke="#F98513"
            strokeWidth="3"
            strokeDasharray="4.4 7.3"
            strokeLinecap="round"
            strokeOpacity=".55"
          />

          {/* Alloy rim: outer lip, five spokes, hub. */}
          <circle
            cx="70"
            cy="72"
            r="27"
            fill="none"
            stroke="#F98513"
            strokeWidth="3.4"
          />
          <circle
            cx="70"
            cy="72"
            r="23"
            fill="none"
            stroke="#F98513"
            strokeWidth="1.4"
            strokeOpacity=".45"
          />
          {[0, 72, 144, 216, 288].map((angle) => (
            <line
              key={angle}
              x1="70"
              y1="72"
              x2="70"
              y2="47.5"
              stroke="#F98513"
              strokeWidth="5"
              strokeLinecap="round"
              transform={`rotate(${angle} 70 72)`}
            />
          ))}
          <circle cx="70" cy="72" r="7.5" fill="#F98513" />
          <circle cx="70" cy="72" r="2.6" fill="#fff" fillOpacity=".85" />
        </g>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
