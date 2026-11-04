/**
 * Default covers for photo-less publishes.
 *
 * The publish form no longer requires an upload, so a text-only listing still
 * has to render a real frame instead of an empty placeholder. These are the
 * same local, already-shipped WebP covers the fixture catalog uses — assigned
 * server-side (never a user path), so photo ownership rules stay intact.
 */
export const DEFAULT_VEHICLE_COVER = '/covers/photos/land-cruiser-kish-thumb.webp';
export const DEFAULT_PART_COVER = '/covers/photos/cayenne-brake-kit-part-thumb.webp';

export function defaultCoverFor(kind: 'vehicle' | 'part' | null | undefined): string {
  return kind === 'part' ? DEFAULT_PART_COVER : DEFAULT_VEHICLE_COVER;
}
