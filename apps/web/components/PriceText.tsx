import { formatAmountLatin, irrToAED, irrToToman } from '@alisales/schemas';

const SOLD_TEXT = '#64748B';

/**
 * Price line for cards, rows and the detail page.
 *
 * The stored price is always IRR. The Kish catalog is an import market, so the
 * card leads with the Toman equivalent buyers negotiate in and shows the
 * dirham amount as the reference (irrToAED / irrToToman, Latin digits). This
 * is display only — no payment or checkout path reads the reference rate.
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
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span
        className={size === 'lg' ? 'text-2xl font-extrabold' : 'text-lg font-extrabold'}
        style={sold ? { color: SOLD_TEXT } : undefined}
      >
        {toman} تومان
      </span>
      <span className="text-xs font-bold text-muted" dir="ltr" style={sold ? { color: SOLD_TEXT } : undefined}>
        ≈ {aed} AED
      </span>
    </span>
  );
}
