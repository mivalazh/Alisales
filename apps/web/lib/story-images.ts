/**
 * Story thumbnails must never depend on a third-party CDN. Iranian mobile
 * carriers routinely block or time out remote images, leaving an empty beige
 * circle. Every broken cover falls back to same-origin automotive artwork that
 * ships with the app.
 */
export const STORY_FALLBACK_IMAGE = '/covers/category-car.jpg';

const LOCAL_STORY_IMAGES: Record<string, string> = {
  'land-cruiser-kish': '/covers/photos/land-cruiser-kish-thumb.webp',
  'patrol-platinum-kish': '/covers/photos/patrol-platinum-kish-thumb.webp',
  's-class-kish': '/covers/photos/s-class-kish-thumb.webp',
  'bmw-x5-kish': '/covers/photos/bmw-x5-kish-thumb.webp',
  'cayenne-kish': '/covers/photos/cayenne-kish-thumb.webp',
  'huracan-showroom': '/covers/photos/huracan-showroom-thumb.webp',
  'lexus-rx-kish': '/covers/photos/lexus-rx-kish-thumb.webp',
  'mclaren-kish-showroom': '/covers/photos/mclaren-kish-showroom-thumb.webp',
  'niu-scooter-kish': '/covers/photos/niu-scooter-kish-thumb.webp',
  'segway-ninebot-kish': '/covers/photos/segway-ninebot-kish-thumb.webp',
};

/** Same-origin fallback for a listing-backed story. */
export function storyImageFallback(slug: string): string {
  const key = slug.replace(/^story-/, '');
  return LOCAL_STORY_IMAGES[key] ?? STORY_FALLBACK_IMAGE;
}
