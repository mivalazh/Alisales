'use client';

import { DEFAULT_AED_TO_IRR, aedToIRR, formatAmountLatin, irrToToman } from '@alisales/schemas';
import { useAedRate } from './RateProvider';
import { usePriceUnit } from './PriceUnitProvider';

/** Product colors, not theme tokens: the price stays on-brand in both themes. */
const PRICE_INK = '#F98513';
const SECONDARY_INK = '#64748B';

/**
 * Price block for cards, rows and the detail page.
 *
 * The stored price is always IRR. The rate comes from the one stored value
 * (`RateProvider` → `/admin/settings`), so every AED figure on the site matches.
 *
 * The headline is bold brand orange (#F98513) text on a transparent background;
 * the reference «≈ … AED» sits directly underneath in muted slate, right-aligned
 * on the start edge of the card, so the figure reads like a classifieds price
 * instead of a button.
 *
 * Display unit («واحد نمایش قیمت») is a viewer preference:
 *  - `both`  → Toman headline + «≈ … AED» reference (the default),
 *  - `toman` → Toman only,
 *  - `aed`   → AED headline + «≈ … تومان» reference.
 *
 * The seller's «فقط تومان» choice (`hideAed`) always wins: the AED figure is
 * then hidden even when the viewer prefers dirhams.
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
  const rate = useAedRate();
  const perAed = rate?.aedToIrr ?? DEFAULT_AED_TO_IRR;
  const { unit } = usePriceUnit();

  const toman = formatAmountLatin(irrToToman(irr));
  const aed = formatAmountLatin(Math.round(irr / perAed));

  const effective = hideAed ? 'toman' : unit;
  const main = effective === 'aed' ? aed : toman;
  const unitLabel = effective === 'aed' ? 'AED' : 'تومان';
  const secondary =
    effective === 'aed' ? `${toman} تومان` : effective === 'both' ? `≈ ${aed} AED` : null;

  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 text-right">
      <span
        dir="ltr"
        className={`whitespace-nowrap font-extrabold tabular-nums tracking-tight ${
          // Cards scale with the column: 15px on a phone, 17px on a tablet and
          // lg on desktop — crisp enough to be the first thing read.
          size === 'lg' ? 'text-xl sm:text-2xl' : 'text-[15px] sm:text-[17px] lg:text-lg'
        }`}
        style={{ color: sold ? SECONDARY_INK : PRICE_INK }}
      >
        {main}
        <span className="ms-1 text-[0.7em] font-bold">{unitLabel}</span>
      </span>
      {/* Fixed slot: an absent reference line keeps the same vertical rhythm,
          so cards in a row stay equal height with or without AED. */}
      <span
        dir="ltr"
        className={`flex items-center whitespace-nowrap text-xs font-semibold ${
          size === 'lg' ? 'h-4' : 'h-3.5'
        }`}
        style={{ color: SECONDARY_INK }}
        aria-hidden={secondary ? undefined : true}
      >
        {secondary ?? '\u00a0'}
      </span>
    </span>
  );
}

/** IRR for an AED amount at the live rate — used by the form's unit switch. */
export function aedPriceToIrr(aed: number, ratePerAed: number): number {
  return aedToIRR(aed, ratePerAed);
}
