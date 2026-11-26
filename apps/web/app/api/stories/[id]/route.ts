import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { deleteStorySubmission, storyById } from '@/lib/data/platform-store';

/**
 * DELETE /api/stories/{id} — the author removes their own story.
 *
 * The signed-in account is the only authority: the row is read first and its
 * `author_id` compared with the session, so a guessed id can never delete
 * someone else's story. `deleteStorySubmission` then removes both the
 * `story_submissions` row and its object in the story bucket.
 */
export const runtime = 'nodejs';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای حذف استوری وارد شوید.' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id.trim()) {
    return NextResponse.json({ error: 'شناسه استوری معتبر نیست.' }, { status: 400 });
  }

  let story: Awaited<ReturnType<typeof storyById>>;
  try {
    story = await storyById(id);
  } catch {
    return NextResponse.json(
      { error: 'خواندن استوری ممکن نشد؛ دوباره تلاش کنید.' },
      { status: 500 },
    );
  }
  if (!story) {
    return NextResponse.json({ error: 'استوری پیدا نشد.' }, { status: 404 });
  }
  if (story.authorId !== session.sub) {
    return NextResponse.json({ error: 'این استوری متعلق به حساب شما نیست.' }, { status: 403 });
  }

  try {
    // Deletes the row and its stored media object in one call.
    await deleteStorySubmission(id);
  } catch {
    return NextResponse.json(
      { error: 'حذف استوری انجام نشد؛ دوباره تلاش کنید.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
