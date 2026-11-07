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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: storageImageHost(),
  // Dev-only host allowlist (preview tunnels). Production never calls next dev.
  allowedDevOrigins: (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

export default nextConfig;
