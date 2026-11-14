import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { storeStoryMedia } from '@/lib/data/media-store';
import {
  isStoryImageMime,
  isStoryVideoMime,
  storyByteLimit,
} from '@/lib/media-rules';

/**
 * POST /api/media/story — upload compressed story media.
 *
 * Images arrive as WebP from the browser pipeline; clips are uploaded as-is.
 * The returned public URL is what `/api/stories` accepts as `mediaUrl`.
 */
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای ثبت استوری وارد شوید.' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'درخواست بارگذاری معتبر نیست.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'فایلی ارسال نشده است.' }, { status: 400 });
  }
  if (!isStoryImageMime(file.type) && !isStoryVideoMime(file.type)) {
    return NextResponse.json({ error: 'فرمت رسانه استوری پشتیبانی نمی‌شود.' }, { status: 400 });
  }
  if (file.size > storyByteLimit(file.type)) {
    return NextResponse.json({ error: 'حجم رسانه استوری بیش از حد مجاز است.' }, { status: 413 });
  }

  const width = Number(form.get('width'));
  const height = Number(form.get('height'));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return NextResponse.json({ error: 'ابعاد رسانه معتبر نیست.' }, { status: 400 });
  }

  try {
    const stored = await storeStoryMedia({
      userId: session.sub,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mime: file.type,
      width,
      height,
    });
    return NextResponse.json({ ok: true, path: stored.path, url: stored.url }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'بارگذاری رسانه استوری انجام نشد؛ دوباره تلاش کنید.' },
      { status: 500 },
    );
  }
}
