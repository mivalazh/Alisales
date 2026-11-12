/**
 * Minimal side-profile car loader: orange/blue accents, rolling wheels and
 * sliding road dashes. Purely decorative, with an accessible label.
 */
export function CarLoader({
  size = 'md',
  label = 'در حال بارگذاری',
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  const width = size === 'sm' ? 96 : size === 'lg' ? 210 : 150;
  return (
    <span
      className="car-loader inline-flex flex-col items-center gap-1.5 text-ink"
      role="status"
      aria-label={label}
      style={{ width }}
    >
      <svg viewBox="0 0 220 88" className="h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id="car-loader-accent" x1="0" x2="1">
            <stop offset="0" stopColor="#0F7FC4" />
            <stop offset="1" stopColor="#F98513" />
          </linearGradient>
        </defs>
        <path
          d="M28 58c2-14 8-23 22-26l20-4c9-9 19-13 35-13h22c12 0 21 5 29 15l13 8c15 2 23 8 25 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M82 29h27v18H64c2-8 7-14 18-18Z" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path d="M117 29h13c10 0 18 5 24 14H117V29Z" fill="none" stroke="currentColor" strokeWidth="2.4" />
        <path d="M30 57h20M156 57h38" stroke="url(#car-loader-accent)" strokeWidth="4" strokeLinecap="round" />
        <path d="M26 68h24M56 68h20M182 68h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity=".28" />
        <g className="car-wheel">
          <circle cx="67" cy="68" r="11" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="67" cy="68" r="3" fill="none" stroke="url(#car-loader-accent)" strokeWidth="2" />
          <path d="M67 59v5M67 72v5M58 68h5M71 68h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <g className="car-wheel car-wheel-back">
          <circle cx="160" cy="68" r="11" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="160" cy="68" r="3" fill="none" stroke="url(#car-loader-accent)" strokeWidth="2" />
          <path d="M160 59v5M160 72v5M151 68h5M164 68h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
