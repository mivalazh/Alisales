/**
 * Deterministic profile cover art.
 *
 * A seller page no longer paints a flat brand banner: it shows one of the
 * catalogue's real vehicle photographs. The pick is a stable hash of the seller
 * id, so the same profile always opens on the same car, while two different
 * sellers almost never share a cover.
 */
const VEHICLE_COVERS = [
  '/covers/photos/land-cruiser-kish.webp',
  '/covers/photos/patrol-platinum-kish.webp',
  '/covers/photos/bmw-x5-kish.webp',
  '/covers/photos/s-class-kish.webp',
  '/covers/photos/cayenne-kish.webp',
  '/covers/photos/lexus-rx-kish.webp',
  '/covers/photos/m5-tehran.webp',
  '/covers/photos/panamera-tehran.webp',
  '/covers/photos/camaro-kish.webp',
  '/covers/photos/camaro-alice.webp',
  '/covers/photos/huracan-showroom.webp',
  '/covers/photos/mclaren-kish-showroom.webp',
  '/covers/photos/boxster-transit.webp',
  '/covers/photos/amg-gt-sold.webp',
] as const;

/** Stable per-seller cover photo (FNV-1a over the id). */
export function coverForSeller(sellerId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < sellerId.length; i += 1) {
    hash ^= sellerId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return VEHICLE_COVERS[Math.abs(hash) % VEHICLE_COVERS.length]!;
}
