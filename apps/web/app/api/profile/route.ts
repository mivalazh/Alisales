import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  BIO_MAX,
  IMAGE_MAX_CHARS,
  profileCustomization,
  saveProfileCustomization,
} from '@/lib/data/social-store';

/**
 * The signed-in seller's own profile customization: avatar, cover banner and
 * bio. Only the session account can read or write its row, and every value is
 * length-capped so a pasted photo cannot bloat the store.
 */
function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'برای ویرایش پروفایل وارد حساب خود شوید.' }, { status: 401 });
}

function cleanImage(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isData = trimmed.startsWith('data:image/');
  const isRemote = /^https?:\/\//.test(trimmed) || trimmed.startsWith('/');
  if (!isData && !isRemote) return undefined;
  if (trimmed.length > IMAGE_MAX_CHARS) return 'too-large';
  return trimmed;
}

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  return NextResponse.json({ profile: profileCustomization(session.sub) });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const body = (raw ?? {}) as { bio?: unknown; avatarUrl?: unknown; coverUrl?: unknown };
  if (body.bio !== undefined && typeof body.bio !== 'string') {
    return NextResponse.json({ error: 'متن بایو باید متن باشد.' }, { status: 400 });
  }
  if (typeof body.bio === 'string' && body.bio.trim().length > BIO_MAX) {
    return NextResponse.json(
      { error: `بایو حداکثر ${BIO_MAX} نویسه است.` },
      { status: 400 },
    );
  }

  const avatarUrl = cleanImage(body.avatarUrl);
  const coverUrl = cleanImage(body.coverUrl);
  if (avatarUrl === 'too-large' || coverUrl === 'too-large') {
    return NextResponse.json({ error: 'حجم تصویر بیش از حد مجاز است.' }, { status: 413 });
  }
  if (avatarUrl === undefined && body.avatarUrl !== undefined) {
    return NextResponse.json({ error: 'نشانی تصویر نامعتبر است.' }, { status: 400 });
  }
  if (coverUrl === undefined && body.coverUrl !== undefined) {
    return NextResponse.json({ error: 'نشانی تصویر نامعتبر است.' }, { status: 400 });
  }

  const saved = saveProfileCustomization(session.sub, {
    bio: typeof body.bio === 'string' ? body.bio : undefined,
    avatarUrl: avatarUrl as string | null | undefined,
    coverUrl: coverUrl as string | null | undefined,
  });
  return NextResponse.json({ ok: true, profile: saved });
}
