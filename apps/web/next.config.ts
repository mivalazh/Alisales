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
};

export default nextConfig;
