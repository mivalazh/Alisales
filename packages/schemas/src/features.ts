import { CITIES } from './vehicle';

/**
 * Product feature flags — one source shared by web and mobile so both apps
 * implement the same rules. Server code reads the matching SUPABASE_FLAGS_*
 * override when present (see apps/web/lib/data/listings.ts); the browser
 * bundle always sees the compiled default below.
 */
export const featureFlags = {
  /** Multi-city picker + city filter. Off at Kish launch: browse is Kish-only. */
  city_selection: false,
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
