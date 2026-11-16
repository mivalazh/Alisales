import type { NextConfig } from 'next';

/** Allow Supabase storage covers when a project URL is configured. */
function storageImageHost(): NextConfig['images'] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return undefined;
  try {
    const hostname = new URL(raw).hostname;
    return {
      remotePatterns: [
        { protocol: 'https', hostname, pathname: '/storage/v1/object/public/**' },
      ],
    };
  } catch {
    return undefined;
  }
}

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Baseline browser hardening. Scripts need inline for the pre-paint theme
 * bootstrap and Next's hydration payload; there is no runtime template or
 * user HTML, so this stays a closed policy apart from the media hosts the
 * marketplace legitimately loads.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  // Inline critical styles are required by the theme bootstrap and by iOS
  // Safari's first paint. HTTPS also covers assets rewritten by the CDN.
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  `connect-src 'self' https: wss:${isDev ? ' ws:' : ''}`,
  "media-src 'self' https: blob:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: storageImageHost(),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=()',
          },
          // HTML must revalidate so an edge node never keeps an old document
          // pointing at a CSS hash that no longer exists.
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          // The HTML carries the signed-in header state; never let one visitor's
          // document be reused for another at a shared edge cache.
          { key: 'Vary', value: 'Cookie, Accept-Encoding' },
          ...(isDev
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=31536000; includeSubDomains',
                },
              ]),
        ],
      },
      // Hashed build output is the only immutable layer.
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          { key: 'CDN-Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // API responses are user/config sensitive and must not be cached.
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
  // Dev-only host allowlist (preview tunnels). Production never calls next dev.
  allowedDevOrigins: (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export default nextConfig;
