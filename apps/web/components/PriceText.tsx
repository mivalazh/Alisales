import { formatAmountLatin, irrToAED, irrToToman } from '@alisales/schemas';

/** Product colors, not theme tokens: the price stays on-brand in both themes. */
const PRICE_INK = '#F98513';
const SECONDARY_INK = '#64748B';

/**
 * Price block for cards, rows and the detail page.
 *
 * The stored price is always IRR. The Kish catalog is an import market, so the
 * Toman amount buyers negotiate in is the headline (large, bold, Latin digits)
 * and the dirham reference sits right below it in the muted secondary color.
 * Display only — no payment or checkout path reads the reference rate, and the
 * rial figure is never shown.
 */
export function PriceText({
  irr,
  sold = false,
  size = 'md',
}: {
  irr: number;
  sold?: boolean;
  /** `md` for cards/rows, `lg` for the detail page. */
  size?: 'md' | 'lg';
}) {
  const toman = formatAmountLatin(irrToToman(irr));
  const aed = formatAmountLatin(irrToAED(irr));

  return (
    <span className="flex flex-col gap-0.5">
      <span
        className={
          size === 'lg'
            ? 'text-2xl font-extrabold leading-tight'
            : 'text-lg font-extrabold leading-tight'
        }
        style={{ color: sold ? SECONDARY_INK : PRICE_INK }}
      >
        {toman} تومان
      </span>
      <span
        className="text-xs font-bold"
        dir="ltr"
        style={{ color: SECONDARY_INK }}
      >
        ≈ {aed} AED
      </span>
    </span>
  );
}
