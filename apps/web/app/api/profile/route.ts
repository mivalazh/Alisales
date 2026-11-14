import { NextResponse } from 'next/server';
import { businessTypes, profileModes } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { CURATED_AVATARS } from '@/lib/avatars';
import { deleteMediaUrl } from '@/lib/data/media-store';
import {
  BIO_MAX,
  profileCustomization,
  saveProfileCustomization,
} from '@/lib/data/social-store';
import { MAX_MEDIA_URL_CHARS, isProfileMediaUrl, ownsMediaUrl } from '@/lib/media-rules';

const CURATED_AVATAR_URLS = new Set(CURATED_AVATARS.map((avatar) => avatar.url));

/**
 * The signed-in seller's own profile customization: avatar, cover banner and
 * bio. Only the session account can read or write its row, and every value is
 * length-capped so a pasted photo cannot bloat the store.
 */
function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'برای ویرایش پروفایل وارد حساب خود شوید.' }, { status: 401 });
}

function cleanImage(
  value: unknown,
  kind: 'avatar' | 'cover',
  userId: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (kind === 'avatar' && CURATED_AVATAR_URLS.has(trimmed)) return trimmed;
  if (trimmed.length > MAX_MEDIA_URL_CHARS) return 'too-large';
  return isProfileMediaUrl(trimmed) && ownsMediaUrl(trimmed, userId) ? trimmed : undefined;
}

export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return unauthorized();
  return NextResponse.json({ profile: await profileCustomization(session.sub) });
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

  const body = (raw ?? {}) as {
    bio?: unknown;
    avatarUrl?: unknown;
    coverUrl?: unknown;
    profileMode?: unknown;
    businessType?: unknown;
  };
  if (body.bio !== undefined && typeof body.bio !== 'string') {
    return NextResponse.json({ error: 'متن بایو باید متن باشد.' }, { status: 400 });
  }
  if (typeof body.bio === 'string' && body.bio.trim().length > BIO_MAX) {
    return NextResponse.json(
      { error: `بایو حداکثر ${BIO_MAX} نویسه است.` },
      { status: 400 },
    );
  }

  if (body.profileMode !== undefined && !profileModes.includes(body.profileMode as never)) {
    return NextResponse.json({ error: 'نوع پروفایل نامعتبر است.' }, { status: 400 });
  }
  if (
    body.businessType !== undefined &&
    body.businessType !== null &&
    !businessTypes.includes(body.businessType as never)
  ) {
    return NextResponse.json({ error: 'نوع کسب‌وکار نامعتبر است.' }, { status: 400 });
  }

  const avatarUrl = cleanImage(body.avatarUrl, 'avatar', session.sub);
  const coverUrl = cleanImage(body.coverUrl, 'cover', session.sub);
  if (avatarUrl === 'too-large' || coverUrl === 'too-large') {
    return NextResponse.json({ error: 'حجم تصویر بیش از حد مجاز است.' }, { status: 413 });
  }
  if (avatarUrl === undefined && body.avatarUrl !== undefined) {
    return NextResponse.json({ error: 'نشانی تصویر نامعتبر است.' }, { status: 400 });
  }
  if (coverUrl === undefined && body.coverUrl !== undefined) {
    return NextResponse.json({ error: 'نشانی تصویر نامعتبر است.' }, { status: 400 });
  }

  const previous = await profileCustomization(session.sub);
  const saved = await saveProfileCustomization(session.sub, {
    bio: typeof body.bio === 'string' ? body.bio : undefined,
    avatarUrl: avatarUrl as string | null | undefined,
    coverUrl: coverUrl as string | null | undefined,
    profileMode:
      body.profileMode === undefined ? undefined : (body.profileMode as 'personal' | 'business'),
    businessType:
      body.businessType === undefined
        ? undefined
        : (body.businessType as 'car-dealer' | 'parts-store' | 'workshop' | 'rental' | null),
  });

  // Replace-or-remove cleanup: old uploaded artwork is deleted only after the
  // row has been saved, so a failed save can never break the current profile.
  if (saved.avatarUrl !== previous?.avatarUrl) {
    await deleteMediaUrl(previous?.avatarUrl);
  }
  if (saved.coverUrl !== previous?.coverUrl) {
    await deleteMediaUrl(previous?.coverUrl);
  }

  return NextResponse.json({ ok: true, profile: saved });
}
