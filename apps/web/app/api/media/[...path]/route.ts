import { readDevMedia } from '@/lib/data/media-store';

/** GET /api/media/:bucket/:path — fixture-mode serving for profile/story media. */
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const [bucket, ...rest] = path;
  const media = bucket ? readDevMedia(bucket, rest.join('/')) : null;
  if (!media) return new Response('not found', { status: 404 });
  return new Response(media.bytes, {
    headers: {
      'content-type': media.mime,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
