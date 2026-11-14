/**
 * Centered luxury-coupe loader: one confident orange line drawing, rolling
 * wheels and animated dashed speed lines. Decorative only; the status label
 * stays available to assistive technology.
 */
export function CarLoader({
  size = 'md',
  label = 'در حال بارگذاری',
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  const width = size === 'sm' ? 88 : size === 'lg' ? 270 : 168;
  return (
    <span
      className="car-loader inline-flex flex-col items-center text-[#F98513]"
      role="status"
      aria-label={label}
      style={{ width }}
    >
      <svg viewBox="0 0 260 112" className="h-auto w-full" aria-hidden="true">
        {/* Speed lines sliding beneath the car. */}
        <g
          className="car-speed"
          stroke="#F98513"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="14 10"
          opacity=".72"
        >
          <path d="M18 96h72" />
          <path d="M96 104h54" />
          <path d="M172 96h70" />
        </g>

        {/* Low, long coupe silhouette. */}
        <path
          d="M22 73c7-2 12-7 16-16 4-9 12-14 25-16l23-3c10-10 22-15 39-15h20c17 0 31 7 42 19l18 6c14 3 22 10 24 22"
          fill="none"
          stroke="#F98513"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M92 41l20-3c9-8 19-12 33-12h20c14 0 25 6 35 16H92Z"
          fill="none"
          stroke="#F98513"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M130 26v18M166 26v18" stroke="#F98513" strokeWidth="2.4" opacity=".75" />
        <path d="M22 73h28M214 73h12" stroke="#F98513" strokeWidth="4" strokeLinecap="round" />
        <path d="M78 56h34M122 56h22" stroke="#F98513" strokeWidth="2.2" strokeLinecap="round" opacity=".4" />

        {/* Wheels: rotating spokes with filled orange hubs. */}
        <g className="car-wheel">
          <circle cx="78" cy="78" r="16" fill="none" stroke="#F98513" strokeWidth="4" />
          <circle cx="78" cy="78" r="6" fill="#F98513" />
          <circle cx="78" cy="78" r="2" fill="#111144" />
          <path d="M78 64v5M78 87v5M64 78h5M87 78h5" stroke="#F98513" strokeWidth="2.4" strokeLinecap="round" />
        </g>
        <g className="car-wheel car-wheel-back">
          <circle cx="198" cy="78" r="16" fill="none" stroke="#F98513" strokeWidth="4" />
          <circle cx="198" cy="78" r="6" fill="#F98513" />
          <circle cx="198" cy="78" r="2" fill="#111144" />
          <path d="M198 64v5M198 87v5M184 78h5M207 78h5" stroke="#F98513" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
