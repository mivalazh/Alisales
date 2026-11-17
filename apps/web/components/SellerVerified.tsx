import { Icon } from './Icon';

/**
 * Verified seller mark — one standardized pill for every verified account.
 *
 * The catalogue data still carries the old showroom label («اتومبیل کیش»),
 * which used to be printed as a `name •` prefix and read like a stray fragment.
 * Nothing prints that label any more: verified sellers show this pill only, and
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
 * Team-verified mark on a profile header: one orange star, no wording.
 * The accessible name lives on the element; nothing is printed next to it.
 */
export function VerifiedStar({ label = 'Verified' }: { label?: string }) {
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex shrink-0">
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="#F98513"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.44 6.19 20.5 7.3 14.03 2.6 9.45l6.5-.95L12 2.6z" />
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
