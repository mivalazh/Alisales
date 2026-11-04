import { formatAmountLatin, irrToAED, irrToToman } from '@alisales/schemas';

/** Product colors, not theme tokens: the price stays on-brand in both themes. */
const PRICE_INK = '#F98513';
const SECONDARY_INK = '#64748B';

/**
 * Price block for cards, rows and the detail page.
 *
 * The stored price is always IRR. The Kish catalog is an import market, so the
 * Toman amount buyers negotiate in is the headline (large, bold, Latin digits)
 * and the dirham reference sits directly underneath it in the muted secondary
 * color. The block is a right-aligned stack: in RTL `items-start` is the start
 * (right) edge, so the `≈ … AED` line stays under the Toman amount instead of
 * floating to the far left.
 *
 * The Toman line never wraps and scales with the viewport (`12px` on a narrow
 * phone, `16px` from `sm` up), so an eleven-digit price still fits beside the
 * «تومان» suffix in a two-column mobile grid. `hideAed` is the seller's
 * «فقط تومان» preference: the reference line is then not rendered at all.
 *
 * Display only — no payment or checkout path reads the reference rate, and the
 * rial figure is never shown.
 */
export function PriceText({
  irr,
  sold = false,
  hideAed = false,
  size = 'md',
}: {
  irr: number;
  sold?: boolean;
  /** Seller chose «عدم نمایش قیمت درهم» for this listing. */
  hideAed?: boolean;
  /** `md` for cards/rows, `lg` for the detail page. */
  size?: 'md' | 'lg';
}) {
  const toman = formatAmountLatin(irrToToman(irr));
  const aed = formatAmountLatin(irrToAED(irr));

  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 text-right">
      <span
        className={
          size === 'lg'
            ? 'whitespace-nowrap text-xl font-extrabold leading-tight sm:text-2xl'
            : 'whitespace-nowrap text-[12px] font-extrabold leading-tight sm:text-base'
        }
        style={{ color: sold ? SECONDARY_INK : PRICE_INK }}
      >
        {toman} تومان
      </span>
      {!hideAed && (
        <span
          className="inline-block self-start whitespace-nowrap text-right text-[10px] font-bold sm:text-xs"
          dir="ltr"
          style={{ color: SECONDARY_INK }}
        >
          ≈ {aed} AED
        </span>
      )}
    </span>
  );
}
