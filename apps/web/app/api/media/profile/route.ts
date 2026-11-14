import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { storeProfileMedia } from '@/lib/data/media-store';
import {
  MAX_PROFILE_MEDIA_BYTES,
  isProfileMime,
  type ProfileMediaKind,
} from '@/lib/media-rules';

/**
 * POST /api/media/profile — upload a compressed avatar or cover.
 *
 * The browser compresses to WebP first (320px avatar / 1280px cover); this
 * route enforces the same limits before writing to the `profile-media` bucket.
 * Returns the durable public URL that `/api/profile` then stores.
 */
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'برای بارگذاری تصویر پروفایل وارد حساب خود شوید.' },
      { status: 401 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'درخواست بارگذاری معتبر نیست.' }, { status: 400 });
  }

  const kind = form.get('kind');
  if (kind !== 'avatar' && kind !== 'cover') {
    return NextResponse.json({ error: 'نوع تصویر پروفایل نامعتبر است.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'فایلی ارسال نشده است.' }, { status: 400 });
  }
  if (!isProfileMime(file.type)) {
    return NextResponse.json({ error: 'فرمت تصویر پشتیبانی نمی‌شود.' }, { status: 400 });
  }
  if (file.size > MAX_PROFILE_MEDIA_BYTES) {
    return NextResponse.json({ error: 'حجم تصویر پروفایل بیش از حد مجاز است.' }, { status: 413 });
  }

  const width = Number(form.get('width'));
  const height = Number(form.get('height'));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return NextResponse.json({ error: 'ابعاد تصویر معتبر نیست.' }, { status: 400 });
  }

  try {
    const stored = await storeProfileMedia({
      userId: session.sub,
      kind: kind as ProfileMediaKind,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mime: file.type,
      width,
      height,
    });
    return NextResponse.json({ ok: true, path: stored.path, url: stored.url }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'بارگذاری تصویر پروفایل انجام نشد؛ دوباره تلاش کنید.' },
      { status: 500 },
    );
  }
}
