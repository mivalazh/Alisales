/**
 * Official Ali Sales lockup.
 *
 * The emblem is drawn inline rather than loaded as a separate asset so its
 * two-tone geometry is present before any stylesheet or network image arrives.
 * Navy is the structural A; the road arcs and lower sweep carry the accent.
 */
const EMBLEM_PATHS = [
  {
    tone: 'var(--logo-navy)',
    d: 'M 234 114 H 278 L 366 303 C 345 294 323 289 301 287 L 255 186 L 209 287 C 185 290 163 296 144 304 L 234 114 Z',
  },
  {
    tone: 'var(--logo-accent)',
    d: 'M 142 311 C 198 287 284 285 369 309 C 287 296 196 306 123 352 L 142 311 Z',
  },
  {
    tone: 'var(--logo-accent)',
    d: 'M 107 386 C 165 328 258 296 370 318 C 339 316 311 319 288 326 C 303 331 314 340 322 356 L 336 386 H 404 L 377 328 C 352 321 319 321 288 326 C 234 335 194 358 168 386 H 107 Z',
  },
] as const;

export function BrandLockup({
  size = 'sm',
  wordmark = true,
}: {
  size?: 'sm' | 'md' | 'lg';
  wordmark?: boolean;
}) {
  const markClass =
    size === 'lg' ? 'h-14 w-auto' : size === 'md' ? 'h-9 w-auto' : 'h-7 w-auto sm:h-8';
  const textClass =
    size === 'lg'
      ? 'text-2xl tracking-[0.12em]'
      : size === 'md'
        ? 'text-base tracking-[0.14em]'
        : 'text-[10px] tracking-[0.08em] sm:text-sm sm:tracking-[0.14em]';

  return (
    <span className="inline-flex items-center gap-2" dir="ltr">
      <svg
        viewBox="80 90 352 320"
        width={352}
        height={320}
        className={`${markClass} shrink-0`}
        aria-hidden="true"
        focusable="false"
      >
        {EMBLEM_PATHS.map((path) => (
          <path
            key={path.d}
            d={path.d}
            fill={path.tone}
          />
        ))}
      </svg>
      {wordmark && (
        <span className={`inline-flex items-baseline gap-[0.18em] whitespace-nowrap font-black ${textClass}`}>
          <span style={{ color: 'var(--logo-navy)' }}>ALI</span>
          <span style={{ color: 'var(--logo-sales)' }}>SALES</span>
        </span>
      )}
    </span>
  );
}
