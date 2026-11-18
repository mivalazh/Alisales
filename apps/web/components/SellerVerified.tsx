import { Icon } from './Icon';

/**
 * Verified seller mark — one standardized seal for every verified account.
 *
 * The catalogue data still carries the old showroom label («اتومبیل کیش»),
 * which used to be printed as a `name •` prefix and read like a stray fragment.
 * Nothing prints that label any more: verified sellers show this seal only, and
 * an unverified seller's name is rendered through `sellerDisplayName`, which
 * strips the legacy prefix.
 */
const LEGACY_PREFIX = /^اتومبیل\s+کیش\s*[•·\-—]?\s*/;

export function sellerDisplayName(name: string | null): string | null {
  if (!name) return null;
  const cleaned = name.replace(LEGACY_PREFIX, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Instagram-style verified rosette: a scalloped seal in ocean blue with the
 * checkmark knocked out in white. No star, no wording — the accessible name
 * lives on the element.
 */
export function VerifiedStar({ label = 'Verified' }: { label?: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-block h-5 w-5 shrink-0"
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        className="h-5 w-5"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="#0F7FC4"
          d="M12 3.6Q15.21 0.02 16.2 4.73Q20.77 3.23 19.27 7.8Q23.98 8.79 20.4 12Q23.98 15.21 19.27 16.2Q20.77 20.77 16.2 19.27Q15.21 23.98 12 20.4Q8.79 23.98 7.8 19.27Q3.23 20.77 4.73 16.2Q0.02 15.21 3.6 12Q0.02 8.79 4.73 7.8Q3.23 3.23 7.8 4.73Q8.79 0.02 12 3.6Z"
        />
        <path
          fill="#fff"
          d="M10.85 15.55 8.1 12.8l1.32-1.32 1.43 1.43 3.73-3.73 1.32 1.32z"
        />
      </svg>
    </span>
  );
}

export function VerifiedPill({
  label = 'نمایشگاه معتبر',
}: {
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#223382]/10 px-2.5 py-0.5 text-xs font-semibold text-[#223382] dark:bg-[#9BACD8]/15 dark:text-[#9BACD8]">
      <Icon name="shieldCheck" size={14} />
      {label}
    </span>
  );
}
