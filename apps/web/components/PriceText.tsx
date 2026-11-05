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
 * The headline sits in its own fixed-height container filled with the brand
 * orange (#F98513), so the spec line above and the reference line below can
 * never collide with it, and every card in a row keeps the same rhythm.
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
  const primary = effective === 'aed' ? `${aed} AED` : `${toman} تومان`;
  const secondary =
    effective === 'aed' ? `${toman} تومان` : effective === 'both' ? `≈ ${aed} AED` : null;

  return (
    <span className="flex min-w-0 flex-col items-start gap-1 text-right">
      <span
        className={
          size === 'lg'
            ? 'flex h-9 items-center overflow-hidden whitespace-nowrap rounded-[7px] px-2.5 text-xl font-extrabold leading-none text-white sm:h-10 sm:px-3 sm:text-2xl'
            : 'flex h-6 items-center overflow-hidden whitespace-nowrap rounded-[5px] px-1.5 text-[12px] font-extrabold leading-none text-white sm:h-7 sm:px-2 sm:text-[15px]'
        }
        style={{ background: sold ? SECONDARY_INK : PRICE_INK }}
      >
        {primary}
      </span>
      {/* Fixed slot: an absent reference line keeps the same vertical rhythm,
          so cards in a row stay equal height with or without AED. */}
      <span
        className="flex h-3.5 items-center self-start whitespace-nowrap text-[10px] font-bold sm:h-4 sm:text-xs"
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
