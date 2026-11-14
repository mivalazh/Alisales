import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { deleteMediaUrl } from '@/lib/data/media-store';
import { parseMediaUrl } from '@/lib/media-rules';

/**
 * DELETE /api/media — remove one of the caller's own uploaded objects.
 *
 * Used by the profile/story clients when a follow-up save fails so a failed
 * publish does not leave an orphan in the bucket. The path must start with the
 * session account id.
 */
export const runtime = 'nodejs';

export async function DELETE(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای حذف رسانه وارد حساب خود شوید.' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }
  const url = typeof (raw as { url?: unknown })?.url === 'string' ? (raw as { url: string }).url : '';
  const parsed = parseMediaUrl(url);
  if (!parsed || !parsed.path.startsWith(`${session.sub}/`)) {
    return NextResponse.json({ error: 'این رسانه متعلق به حساب شما نیست.' }, { status: 403 });
  }

  await deleteMediaUrl(url);
  return NextResponse.json({ ok: true });
}
