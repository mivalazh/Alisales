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
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
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
    ];
  },
  // Dev-only host allowlist (preview tunnels). Production never calls next dev.
  allowedDevOrigins: (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export default nextConfig;
