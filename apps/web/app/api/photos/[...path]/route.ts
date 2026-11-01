import { readDevPhoto } from '@/lib/data/photo-store';

/**
 * GET /api/photos/{sellerId}/{file}.webp — fixture-mode photo serving.
 *
 * Hosted listings use the public Supabase URL, so this route only finds files
 * in `.dev-data/photos` (written by `storePhoto` in credential-less mode).
 * Paths are resolved inside that folder; anything else 404s.
 */
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const photo = readDevPhoto(path.join('/'));
  if (!photo) return new Response('not found', { status: 404 });
  return new Response(photo.bytes, {
    headers: {
      'content-type': photo.mime,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
