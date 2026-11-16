import Image from 'next/image';

/**
 * Official Ali Sales brand lockup: the transparent road-swoosh "A" beside the
 * ALI SALES wordmark. The navy mark is used on light surfaces and the white mark
 * on dark surfaces; the SVG geometry is the vector master in `public/`.
 */
export function BrandLockup({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const markClass = size === 'md' ? 'h-9 w-auto' : 'h-7 w-auto sm:h-8';
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/logo-mark-navy.svg"
        alt=""
        width={352}
        height={320}
        unoptimized
        className={`${markClass} dark:hidden`}
      />
      <Image
        src="/logo-mark-white.svg"
        alt=""
        width={352}
        height={320}
        unoptimized
        className={`${markClass} hidden dark:block`}
      />
      <span
        className={`whitespace-nowrap font-black text-ink ${
          size === 'md'
            ? 'text-base tracking-[0.14em]'
            : 'text-[10px] tracking-[0.08em] sm:text-sm sm:tracking-[0.14em]'
        }`}
      >
        ALI SALES
      </span>
    </span>
  );
}
