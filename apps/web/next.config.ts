import { networkInterfaces } from 'node:os';
import type { NextConfig } from 'next';
import {
  demoListingsHiddenValue,
  productionCatalogueIssue,
} from './lib/config/build-guard';
import { privateDevOrigins } from './lib/config/dev-origins';

/**
 * Fail `next build` before it prerenders an empty catalogue: a production build
 * with the seed hidden and no hosted read credentials would otherwise cache
 * empty HTML. Next passes the running phase to the config, so this cannot fire
 * on `next dev` or `next start` — only on `phase-production-build`.
 */
function assertCatalogueBuild(phase: string): void {
  const issue = productionCatalogueIssue({
    nodeEnv: process.env.NODE_ENV,
    phase,
    demoHidden: demoListingsHiddenValue(
      process.env.NEXT_PUBLIC_HIDE_DEMO_LISTINGS,
      process.env.NODE_ENV,
    ),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    allowEmpty: process.env.ALLOW_EMPTY_CATALOGUE,
  });
  if (issue) throw new Error(issue);
}

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

/**
 * Statically generated catalogue pages.
 *
 * Their HTML is identical for every visitor (no session, no language cookie,
 * no search params in the render), so the CDN may keep it for a minute and
 * serve a stale copy while the next one is generated. Every other page stays
 * `private, no-store`.
 */
const CATALOGUE_ROUTES = ['/', '/cars', '/parts', '/motorcycles', '/heavy'] as const;

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

const config: NextConfig = {
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
          // Personalised HTML (profile, chats, login, admin) must never be
          // reused for another visitor. The catalogue routes below override
          // this with a public one-minute edge cache.
          {
            key: 'Cache-Control',
            value: 'private, no-store, max-age=0, must-revalidate',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'no-store',
          },
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
      // Catalogue HTML: one minute at the edge, then a background revalidate.
      // Listed after the catch-all so these values win for these paths, and
      // without `Vary: Cookie` because the document no longer depends on it.
      ...CATALOGUE_ROUTES.map((source) => ({
        source,
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      })),
    ];
  },
  // Dev-only host allowlist (preview tunnels, cloud previews). Production
  // never calls next dev. The machine's own LAN addresses are added in
  // development below, so phone testing needs no environment setup.
  allowedDevOrigins: (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

/** The function form is what lets Next hand us the phase it is running in. */
export default function nextConfig(phase: string): NextConfig {
  assertCatalogueBuild(phase);
  if (phase !== 'phase-development-server') return config;

  // A phone opening http://<lan-ip>:3000 sends that address as its Origin, and
  // Next blocks dev resources from unlisted origins — the page renders but
  // never hydrates. Private addresses are unreachable from the public internet,
  // so they are the same trust level as localhost and need no opt-in.
  return {
    ...config,
    allowedDevOrigins: [
      ...new Set([...(config.allowedDevOrigins ?? []), ...privateDevOrigins(networkInterfaces())]),
    ],
  };
}
