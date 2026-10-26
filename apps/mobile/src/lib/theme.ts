import { tokens } from '@studio/design';

/**
 * React Native can't consume CSS custom properties, so the shared 60-30-10
 * design tokens are read from @studio/design's JS object instead — same source
 * as the web app's tokens.css (parity-tested in the design package).
 */

const px = (value: unknown): number =>
  typeof value === 'number' ? value : parseFloat(String(value));

const t = (key: keyof typeof tokens): string => String(tokens[key]);

export const colors = {
  page: t('color-surface-subtle'),
  card: t('color-surface'),
  sunken: t('color-surface-sunken'),
  inverse: t('color-surface-inverse'),
  ink: t('color-text-primary'),
  muted: t('color-text-secondary'),
  faint: t('color-text-tertiary'),
  line: t('color-border-subtle'),
  lineStrong: t('color-border-strong'),
  cta: t('color-accent'),
  ctaOn: t('color-text-on-accent'),
  ctaSoft: t('color-accent-soft'),
  danger: t('color-danger-fg'),
  dangerSoft: t('color-danger-bg'),
  success: t('color-success-fg'),
  successSoft: t('color-success-bg'),
  warning: t('color-warning-fg'),
  warningSoft: t('color-warning-bg'),
  white: '#ffffff',
};

export const spacing = {
  xs: px(tokens['space-1']),
  sm: px(tokens['space-2']),
  md: px(tokens['space-3']),
  lg: px(tokens['space-4']),
  xl: px(tokens['space-6']),
  xxl: px(tokens['space-8']),
};

export const radius = {
  sm: px(tokens['radius-sm']),
  card: px(tokens['radius-lg']),
  field: px(tokens['radius-md']),
  pill: px(tokens['radius-pill']),
};

/** 44px minimum touch target (spec §2). */
export const touch = px(tokens['touch-min']);

/** Design token photo aspect (4:3). */
export const PHOTO_ASPECT = 4 / 3;

export const type = {
  xs: px(tokens['font-size-xs']),
  sm: px(tokens['font-size-sm']),
  base: px(tokens['font-size-base']),
  md: px(tokens['font-size-md']),
  lg: px(tokens['font-size-lg']),
  xl: px(tokens['font-size-xl']),
};
