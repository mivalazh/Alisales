import { groupDigits } from './locale';
import { toPersianDigits } from './locale';

/**
 * The one AED → Toman reference rate.
 *
 * Every AED figure in the product (cards, rows, the detail page, the publish
 * form's unit switch) is derived from this module and the single stored rate
 * value — no screen keeps its own constant.
 *
 * Units: the database stores IRR (rial). The rate is expressed as
 * `aedToIrr` (rial per 1 AED). A rate entered in *toman* is multiplied by 10
 * once, at the boundary (`tomanRateToIrr`), so a stored 27,200 is ۲۷٬۲۰۰ تومان
 * and never ۲٬۷۲۰ تومان by accident.
 */

/** 1 AED = 272,000 IRR = 27,200 Toman — the launch reference. */
export const DEFAULT_AED_TO_IRR = 272_000;
/** Legacy name for the same seed value. */
export const AED_TO_IRR = DEFAULT_AED_TO_IRR;
export const IRR_PER_TOMAN = 10;

export type RateSource = 'default' | 'admin' | 'auto';

export interface AedRate {
  /** Rial per 1 AED. */
  aedToIrr: number;
  /** ISO timestamp of this value. */
  updatedAt: string;
  source: RateSource;
}

/** The seeded reference rate, stamped once so «آخرین بروزرسانی» is honest. */
export const DEFAULT_AED_RATE: AedRate = {
  aedToIrr: DEFAULT_AED_TO_IRR,
  updatedAt: '2026-11-01T00:00:00.000Z',
  source: 'default',
};

export function aedToIRR(aed: number, rate: number = DEFAULT_AED_TO_IRR): number {
  return Math.round(aed * rate);
}

export function irrToAED(irr: number, rate: number = DEFAULT_AED_TO_IRR): number {
  return Math.round(irr / rate);
}

export function tomanToIRR(toman: number): number {
  return Math.round(toman * IRR_PER_TOMAN);
}

export function irrToToman(irr: number): number {
  return Math.round(irr / IRR_PER_TOMAN);
}

/** Toman value of one AED — what the UI line prints. */
export function aedToToman(rate: number = DEFAULT_AED_TO_IRR): number {
  return irrToToman(rate);
}

/** An admin types Toman; the store keeps rial. */
export function tomanRateToIrr(tomanPerAed: number): number {
  return tomanToIRR(tomanPerAed);
}

/**
 * The window a real AED rate can sit in: 15,000–60,000 Toman per dirham.
 *
 * A live feed that answers `0`, `NaN`, a rial/toman mix-up or a stale number
 * must never reach a price on the site, so every automatic value is checked
 * against this window before it is stored.
 */
export const MIN_AED_TOMAN = 15_000;
export const MAX_AED_TOMAN = 60_000;

/** Guarded parse of a stored/admin value (rial per AED). */
export function isPlausibleAedRate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_AED_TOMAN * IRR_PER_TOMAN &&
    value <= MAX_AED_TOMAN * IRR_PER_TOMAN
  );
}

/** The same guard for a value already expressed in Toman. */
export function isPlausibleAedRateToman(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_AED_TOMAN &&
    value <= MAX_AED_TOMAN
  );
}

/** The dirham's long-standing peg to the dollar — used by the Tether fallback. */
export const AED_PER_USD = 3.6725;

/** «۱ درهم ≈ ۲۷٬۲۰۰ تومان» — Persian digits with the ٬ separator. */
export function formatAedRateLine(rate: AedRate): string {
  return `۱ درهم ≈ ${toPersianDigits(groupDigits(aedToToman(rate.aedToIrr)))} تومان`;
}

/** The same number without the sentence, for chips and the form. */
export function formatAedToman(rate: AedRate): string {
  return `${toPersianDigits(groupDigits(aedToToman(rate.aedToIrr)))} تومان`;
}
