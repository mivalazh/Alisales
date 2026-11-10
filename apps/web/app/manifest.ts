import type { MetadataRoute } from 'next';

/**
 * Installable app manifest.
 *
 * The marketplace is usable as a normal website, but installing it opens the
 * same routes in a standalone window with the native app chrome: no browser
 * address bar, portrait orientation, navy status bar and the Ali Sales mark on
 * the home screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ali Sales — Kish marketplace',
    short_name: 'Ali Sales',
    description:
      'Buy and sell new and used vehicles, electric bikes, heavy machinery and spare parts in Kish.',
    lang: 'fa',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#111144',
    background_color: '#F4F1EC',
    categories: ['shopping', 'business', 'lifestyle'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
