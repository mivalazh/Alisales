import { NextResponse } from 'next/server';
import { ALLOWED_PHOTO_MIME, MAX_PHOTO_BYTES } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { storePhoto } from '@/lib/data/photo-store';

/**
 * POST /api/photos — upload one compressed listing photo.
 *
 * Accepts the WebP blob produced by the client pipeline (`lib/photos.ts`) plus
 * its pixel size, and returns `{ path, url }`. The path is what the listing
 * payload carries; the bytes are stored here and never travel inside the
 * listing JSON.
 *
 * - Guests get 401 (the upload happens on the guarded /new page).
 * - mime / size / dimension limits mirror the shared schema and the
 *   `listing_photos` table constraints, so an invalid file cannot reach the DB.
 */
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'برای بارگذاری عکس ابتدا وارد حساب خود شوید.' },
      { status: 401 },
    );
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
  if (!(ALLOWED_PHOTO_MIME as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: 'فرمت عکس پشتیبانی نمی‌شود (JPG، PNG یا WebP).' },
      { status: 400 },
    );
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: 'حجم عکس بیش از حد مجاز است.' }, { status: 413 });
  }

  const width = Number(form.get('width'));
  const height = Number(form.get('height'));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return NextResponse.json({ error: 'ابعاد عکس معتبر نیست.' }, { status: 400 });
  }

  try {
    const stored = await storePhoto({
      sellerId: session.sub,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mime: file.type,
      width,
      height,
    });
    return NextResponse.json({ ok: true, path: stored.path, url: stored.url }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'بارگذاری عکس انجام نشد؛ دوباره تلاش کنید.' },
      { status: 500 },
    );
  }
}
