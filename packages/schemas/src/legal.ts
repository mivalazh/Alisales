/**
 * ⚠ LEGAL_REVIEW_REQUIRED — plate-status copy and sectioning.
 *
 * Product/legal decision (2026-10): the platform does NOT show a mandatory
 * legal disclaimer or forced police-inspection warning. The seller is solely
 * responsible for declaring plate status. Kish-plate vehicles and
 * temporary-transit/un-plated vehicles are presented in two distinct sections.
 *
 * Changing any text or section rule in this file requires legal review.
 */
import type { PlateType } from './enums';

export const PLATE_SECTIONS = {
  kish: {
    key: 'kish',
    title: 'پلاک کیش',
    plates: ['kish'] as const satisfies readonly PlateType[],
    statements: {
      kish: 'فروشنده این خودرو را دارای پلاک جزیره کیش اعلام کرده است.',
    },
  },
  temporary_or_unplated: {
    key: 'temporary_or_unplated',
    title: 'گذر موقت / بدون پلاک',
    plates: ['temporary_transit', 'unplated'] as const satisfies readonly PlateType[],
    statements: {
      temporary_transit: 'فروشنده این خودرو را دارای پلاک گذر موقت اعلام کرده است.',
      unplated: 'فروشنده این خودرو را بدون پلاک اعلام کرده است.',
    },
  },
} as const;

export type PlateSectionKey = keyof typeof PLATE_SECTIONS;

/** Footer under either section. */
export const PLATE_DECLARATION_FOOTER = 'وضعیت پلاک توسط فروشنده مشخص و اعلام می‌شود.';

/** `standard` plates show no section. */
export function plateSectionKey(plateType: PlateType): PlateSectionKey | null {
  if (plateType === 'kish') return 'kish';
  if (plateType === 'temporary_transit' || plateType === 'unplated') return 'temporary_or_unplated';
  return null;
}

export function plateStatement(plateType: PlateType): string | null {
  const sectionKey = plateSectionKey(plateType);
  if (!sectionKey) return null;
  const statements = PLATE_SECTIONS[sectionKey].statements as Partial<
    Record<PlateType, string>
  >;
  return statements[plateType] ?? null;
}
