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
