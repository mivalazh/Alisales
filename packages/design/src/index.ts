// Canonical Palette A tokens (source of truth — see tokens.ts)
export {
  palette,
  neutral,
  light,
  dark,
  statusTag,
  badgeTag,
  legacyColors,
  tokens,
  cssVar,
  cssTokenName,
  motion,
} from './tokens';
export type { TokenKey, TokenValue, StatusTagKey } from './tokens';

// Status badges + card tag helper
export {
  STATUS_BADGES,
  CORE_BADGES,
  LIFECYCLE_STATES,
  badgeKeys,
  badgeFor,
  lifecycleTagFor,
  tagsForListing,
} from './status';
export type {
  BadgeKey,
  BadgeToken,
  ListingLifecycleState,
  ListingPlateType,
} from './status';

// Shared icon registry (web inline SVG / mobile react-native-svg)
export { ICONS, ICON_VIEWBOX, ICON_STROKE_WIDTH, iconFor } from './icons';
export type { IconDef, IconName } from './icons';

// Brand marks
export { LOGO, logoSvgDocument } from './logo';
export type { LogoVariant } from './logo';
