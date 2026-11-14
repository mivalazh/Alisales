import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { listingsBySeller } from '@/lib/data/s2-store';
import { adminSettings, addStory, listStories } from '@/lib/data/platform-store';
import { profileCustomization } from '@/lib/data/social-store';
import { MAX_MEDIA_URL_CHARS, isStoryMediaUrl, ownsMediaUrl } from '@/lib/media-rules';

/**
 * Story submissions.
 *
 * GET  — approved launch stories for the rail, the current paid-guard flag and
 *        (for a signed-in user) their own listings to attach a story to.
 * POST — publish a free story: media already uploaded to `story-media`, or a
 *        story attached to one of the caller's listings. The paid guard only
 *        changes the resulting status; it never blocks the upload silently.
 */

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  const [approvedRows, settings] = await Promise.all([
    listStories('approved'),
    adminSettings(),
  ]);
  const approved = await Promise.all(
    approvedRows
      .filter((story) => isStoryMediaUrl(story.mediaUrl))
      .slice(0, 12)
      .map(async (story) => {
        const custom = await profileCustomization(story.authorId);
        return {
          id: story.id,
          title: story.title,
          mediaUrl: story.mediaUrl,
          mediaKind: story.mediaKind,
          listingSlug: story.listingSlug,
          authorId: story.authorId,
          // Never send viewers to a private personal profile.
          authorProfilePublic: custom?.profileMode === 'business',
        };
      }),
  );

  let mine: Array<{ slug: string; title: string; coverUrl: string | null }> = [];
  if (session) {
    const listings = await listingsBySeller(session.sub);
    mine = listings
      .filter((listing) => listing.state === 'active')
      .slice(0, 12)
      .map((listing) => ({
        slug: listing.slug,
        title: listing.part ? listing.part.title : `${listing.model} ${listing.year}`,
        coverUrl: listing.coverUrl,
      }));
  }

  return NextResponse.json({
    stories: approved,
    mine,
    paidGuard: settings.storyPaidGuard,
  });
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای ثبت استوری وارد شوید.' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const body = (raw ?? {}) as Record<string, unknown>;
  const mediaUrl = text(body.mediaUrl, MAX_MEDIA_URL_CHARS);
  const mediaKind = body.mediaKind === 'video' ? 'video' : 'image';
  const listingSlug = text(body.listingSlug, 120) || null;
  const title = text(body.title, 80) || (session.displayName ?? 'استوری Ali Sales');

  // Only objects in our own story bucket: never an arbitrary remote URL, a
  // data URL, or a `javascript:` payload rendered into the rail.
  if (!isStoryMediaUrl(mediaUrl) || !ownsMediaUrl(mediaUrl, session.sub)) {
    return NextResponse.json({ error: 'فایل استوری نامعتبر است.' }, { status: 400 });
  }

  if (listingSlug) {
    const listings = await listingsBySeller(session.sub);
    if (!listings.some((listing) => listing.slug === listingSlug)) {
      return NextResponse.json(
        { error: 'فقط می‌توانید استوری آگهی‌های خودتان را منتشر کنید.' },
        { status: 403 },
      );
    }
  }

  const story = await addStory({
    title,
    mediaUrl,
    mediaKind,
    authorId: session.sub,
    authorName: session.displayName ?? '',
    listingSlug,
  });

  return NextResponse.json(
    { ok: true, id: story.id, status: story.status },
    { status: 201 },
  );
}
