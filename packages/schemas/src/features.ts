import { CITIES } from './vehicle';

/**
 * Product feature flags — one source shared by web, mobile and server code.
 * Server code reads the matching SUPABASE_FLAGS_* override when present (see
 * apps/web/lib/data/listings.ts); the browser bundle always sees the compiled
 * default below.
 *
 * A flag is flipped only by the stage that owns the feature — never to make a
 * half-built screen reachable. Disabled features must stay unreachable in the
 * UI (no dead buttons, no placeholder routes that pretend to work).
 */
export const featureFlags = {
  /** Multi-city picker + city filter. Off at Kish launch: browse is Kish-only. */
  city_selection: false,
  /** Paid plans (personal / showroom), plan screen and limits beyond the free tier. */
  subscriptions: false,
  /** 24-hour stories row (video/image + required listing link). */
  stories: true,
  /** Non-car listings (parts & accessories) alongside vehicles. */
  parts_listings: true,
  /** Verified workshop inspection reports. */
  repair_inspection: false,
  /** Structured visit-request messages inside chat. */
  visit_request_chat: true,
  /** Public favorite counts on cards/detail. Owner-only numbers work regardless. */
  public_favorite_count: false,
  /** Bump-up (نردبان) promotion for paid-plan users. */
  bump_up: true,
  /** Demo screen gallery (internal previews). */
  demo_screens: false,
  /** Dev-only OTP bypass: accepts "123456" ONLY while demo_screens is on. */
  demo_login: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export const DEFAULT_CITY = 'kish';

type City = (typeof CITIES)[number];

/**
 * The cities users may pick today. While `city_selection` is off this is
 * Kish only (launch region); the 11-city catalog itself is unchanged.
 */
export function selectableCities(flagOn: boolean = featureFlags.city_selection): City[] {
  if (flagOn) return [...CITIES];
  const launch = CITIES.find((c) => c.slug === DEFAULT_CITY);
  return launch ? [launch] : [];
}
