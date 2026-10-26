/**
 * @studio/design — single source of truth for design tokens (Alisales).
 *
 * Palette A (approved) — the ONLY colors allowed anywhere in this package:
 *
 *   lusterWhite     #F4F1EC   asterFlowerBlue  #9BACD8   habanero       #F98513
 *   jodhpurTan      #DAD1C8   deepSpaceRoyal   #223382   deadlyDepths   #111144
 *
 * plus ONE approved neutral exception: `neutral.white` (#FFFFFF), used only
 * for light card surfaces and text on the primary navy button.
 *
 * Structure of this file:
 *   - `palette` / `neutral` — raw approved values.
 *   - `light` / `dark`      — canonical mode palettes (source of truth).
 *   - `statusTag`           — the five fixed status-tag pairs (fg = text).
 *   - `badgeTag`            — every badge (core + lifecycle) maps onto a
 *                              statusTag pair; no badge may invent colors.
 *   - `legacyColors`        — TRANSITIONAL view: old `color-*` keys mapped to
 *                             canonical values so apps/web and apps/mobile keep
 *                             compiling until their migration steps. Contains
 *                             no hex literals of its own (purity-tested).
 *   - `tokens`              — legacyColors + non-color structural tokens
 *                             (spacing, radii, type, motion, layout).
 *
 * CSS parity (tests/tokens.test.ts): `light` and `statusTag` mirror the
 * `:root` variables in tokens.css, `dark` mirrors `:root[data-theme='dark']`.
 */
export const palette = {
  lusterWhite: '#F4F1EC',
  asterFlowerBlue: '#9BACD8',
  habanero: '#F98513',
  jodhpurTan: '#DAD1C8',
  deepSpaceRoyal: '#223382',
  deadlyDepths: '#111144',
} as const;

/** Single approved neutral exception — never a brand color (see purity test). */
export const neutral = {
  white: '#FFFFFF',
} as const;

export const light = {
  bg: palette.lusterWhite,
  surface: neutral.white,
  surfaceMuted: palette.lusterWhite,
  border: palette.jodhpurTan,
  borderControl: palette.deepSpaceRoyal,
  text: palette.deadlyDepths,
  textMuted: palette.deepSpaceRoyal,
  price: palette.deepSpaceRoyal,
  primaryAction: palette.deepSpaceRoyal,
  onPrimaryAction: neutral.white,
  primaryActionHover: palette.deadlyDepths,
  plusButton: palette.habanero,
  onPlusButton: palette.deadlyDepths,
  focusRing: palette.deepSpaceRoyal,
  navActive: palette.deadlyDepths,
  navInactive: palette.deepSpaceRoyal,
  softAccent: palette.jodhpurTan,
} as const;

export const dark = {
  bg: palette.deadlyDepths,
  surface: palette.deepSpaceRoyal,
  surfaceMuted: palette.deepSpaceRoyal,
  border: palette.deepSpaceRoyal,
  borderControl: palette.asterFlowerBlue,
  text: palette.lusterWhite,
  textMuted: palette.asterFlowerBlue,
  price: palette.habanero,
  primaryAction: palette.habanero,
  onPrimaryAction: palette.deadlyDepths,
  primaryActionHover: palette.lusterWhite,
  plusButton: palette.habanero,
  onPlusButton: palette.deadlyDepths,
  focusRing: palette.habanero,
  navActive: palette.habanero,
  navInactive: palette.asterFlowerBlue,
  softAccent: palette.deepSpaceRoyal,
} as const;

/** The five status tags — fixed bg/text pairs (text also draws the 1px border). */
export const statusTag = {
  new: { bg: palette.deadlyDepths, text: palette.lusterWhite },
  used: { bg: palette.jodhpurTan, text: palette.deadlyDepths },
  kishPlate: { bg: palette.asterFlowerBlue, text: palette.deadlyDepths },
  transit: { bg: palette.habanero, text: palette.deadlyDepths },
  verified: { bg: palette.deepSpaceRoyal, text: palette.lusterWhite },
} as const;

export type StatusTagKey = keyof typeof statusTag;

/**
 * Every badge — five core product tags + seven lifecycle states — renders as
 * a statusTag pair (decision: no new badge colors, ever).
 *
 *   neutral states → used · attention → transit · official · sold → transit
 *   plates keep kishPlate · report keeps verified
 *
 * Note: `sold` renders on cards (Phase 2 / D2 — sold stays in the catalog)
 * and borrows the `transit` pair (bg #F98513 / text #111144), so no new
 * color enters the palette.
 */
export const badgeTag = {
  // Core product badges
  new: 'new',
  used: 'used',
  kish_plate: 'kishPlate',
  temporary_transit: 'transit',
  verified_report: 'verified',
  // Listing lifecycle
  draft: 'used',
  pending_review: 'transit',
  active: 'verified',
  paused: 'used',
  sold: 'transit', // approved Sold badge = the existing transit pair
  expired: 'used',
  rejected: 'transit',
} as const satisfies Record<string, StatusTagKey>;

/**
 * TRANSITIONAL — old `color-*` token names → canonical values.
 * Deleted when web (S4) and mobile adopt the canonical keys.
 * Every value derives from `light` / `palette`; no hex literals here.
 */
export const legacyColors = {
  'color-surface': light.surface, // #FFFFFF — approved card surface
  'color-surface-subtle': light.bg,
  'color-surface-sunken': light.softAccent,
  'color-surface-inverse': light.primaryAction,
  'color-text-primary': light.text,
  'color-text-secondary': light.textMuted,
  'color-text-tertiary': light.textMuted, // no lighter AA-safe value exists
  'color-text-inverse': palette.lusterWhite,
  'color-text-on-accent': light.onPrimaryAction, // #FFFFFF — label on navy CTA
  'color-border-subtle': light.border,
  'color-border-strong': light.borderControl,
  'color-accent': light.primaryAction, // primary CTA = navy
  'color-accent-hover': light.primaryActionHover,
  'color-accent-pressed': light.primaryActionHover, // press = motion, not a new hue
  'color-accent-soft': light.softAccent,
  'color-focus-ring': light.focusRing,
  // Semantic trio — palette-only, mode-independent (never color alone in UI):
  'color-success-fg': palette.deepSpaceRoyal, // check icon + text
  'color-success-bg': light.softAccent,
  'color-warning-fg': palette.deadlyDepths,
  'color-warning-bg': palette.habanero, // habanero bg + deadlyDepths text
  'color-danger-fg': palette.deadlyDepths, // error = text + alert icon
  'color-danger-bg': light.softAccent,
  'color-info-fg': palette.deepSpaceRoyal,
  'color-info-bg': light.softAccent,
} as const;

/** Non-color structural tokens (spacing, radii, type, motion, layout). */
const structural = {
  // Spacing scale
  'space-0': '0px',
  'space-1': '4px',
  'space-2': '8px',
  'space-3': '12px',
  'space-4': '16px',
  'space-5': '20px',
  'space-6': '24px',
  'space-8': '32px',
  'space-10': '40px',
  'space-12': '48px',

  // Radii
  'radius-sm': '6px',
  'radius-md': '10px',
  'radius-lg': '14px',
  'radius-xl': '20px',
  'radius-pill': '999px',

  // Typography (px)
  'font-size-xs': '12px',
  'font-size-sm': '13px',
  'font-size-base': '15px',
  'font-size-md': '17px',
  'font-size-lg': '20px',
  'font-size-xl': '24px',
  'font-size-2xl': '30px',
  'font-size-3xl': '38px',
  'line-height-tight': '1.25',
  'line-height-normal': '1.55',

  // Price display rule (dark-card price is 4.503:1 — enforce size ≥16px/500)
  'price-font-weight': '500',
  'price-font-size': '16px',

  // Motion — minimal: bottom sheets 250ms, press feedback only
  'motion-sheet-duration': '250ms',
  'motion-press-duration': '100ms',
  'motion-ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',

  // Layout
  'touch-min': '44px',
  'content-max': '1180px',
  'photo-aspect': '4 / 3',
} as const;

/**
 * Transitional aggregate: legacy color keys + structural tokens.
 * Apps keep reading `tokens['color-…']` until their migration step; new code
 * should read `light` / `dark` / `statusTag` directly.
 */
export const tokens = {
  ...legacyColors,
  ...structural,
} as const;

export type TokenKey = keyof typeof tokens;
export type TokenValue = (typeof tokens)[TokenKey];

/** `var(--color-surface)` style reference for a legacy token key. */
export function cssVar(key: TokenKey): string {
  return `var(--${key})`;
}

export const motion = {
  sheetDuration: tokens['motion-sheet-duration'],
  pressDuration: tokens['motion-press-duration'],
  ease: tokens['motion-ease-standard'],
} as const;

/** camelCase → kebab-case (canonical token key → CSS variable name). */
export function cssTokenName(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}
