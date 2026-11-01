import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  MAX_PHOTOS,
  citySlugs,
  listingPhotoSchema,
  type ListingPhoto,
} from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { admin } from '@/lib/data/s2-store';
import { updateHostedListing, type ListingPatch } from '@/lib/data/publish-store';
import { isOwnedPhotoPath } from '@/lib/data/photo-rules';
import { updateDevListing } from '@/lib/data/dev-store';

/**
 * PATCH /api/listings/{id} — edit a listing (owner only).
 *
 * Photos: the browser uploads new files to `/api/photos` and sends the ordered
 * set here. The hosted path replaces `listing_photos` rows in one transaction-
 * like sequence (old rows read first, new insert failure restores them);
 * fixture mode rewrites the dev-store card so offline editing behaves the same.
 *
 * Editable fields are deliberately narrow — price, description, city and the
 * phone-reveal opt-in. Vehicle identity (brand/model/year/VIN), state
 * transitions and plan limits have their own rules and are not patched here.
 * Money is never involved: no payment, checkout or commission code exists for
 * listings (subscriptions/bump-up/stories only).
 */
const patchSchema = z
  .object({
    priceIRR: z.number().int().min(0).max(10 ** 15).optional(),
    description: z.string().trim().min(20).max(3000).optional(),
    city: z.enum(citySlugs as [string, ...string[]]).optional(),
    allowPhoneReveal: z.boolean().optional(),
    photos: z.array(listingPhotoSchema).min(1).max(MAX_PHOTOS).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'هیچ تغییری ارسال نشده است.' });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای ویرایش آگهی وارد حساب خود شوید.' }, { status: 401 });
  }

  const { id } = await context.params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const patch = parsed.data as ListingPatch;
  if (patch.photos && patch.photos.some((photo: ListingPhoto) => !isOwnedPhotoPath(photo.path, session.sub))) {
    return NextResponse.json(
      { error: 'عکس‌ها معتبر نیستند؛ لطفاً دوباره بارگذاری کنید.' },
      { status: 400 },
    );
  }

  if (admin()) {
    const result = await updateHostedListing({ id, sellerId: session.sub, patch });
    if (!result.ok) {
      if (result.status === 404) {
        return NextResponse.json({ error: 'آگهی پیدا نشد.' }, { status: 404 });
      }
      if (result.status === 403) {
        return NextResponse.json({ error: 'این آگهی متعلق به شما نیست.' }, { status: 403 });
      }
      return NextResponse.json(
        { error: 'ویرایش آگهی انجام نشد؛ دوباره تلاش کنید.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  const { devListings } = await import('@/lib/data/dev-store');
  const existing = devListings().find((listing) => listing.id === id);
  if (!existing) {
    return NextResponse.json({ error: 'آگهی پیدا نشد.' }, { status: 404 });
  }
  if (existing.sellerId !== session.sub) {
    return NextResponse.json({ error: 'این آگهی متعلق به شما نیست.' }, { status: 403 });
  }

  const nextPhotos = patch.photos
    ? [...patch.photos]
        .sort((a, b) => a.position - b.position)
        .map((photo) => `/api/photos/${photo.path}`)
    : existing.photos;

  updateDevListing(id, {
    ...(patch.priceIRR !== undefined ? { priceIRR: patch.priceIRR } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.city !== undefined ? { city: patch.city } : {}),
    ...(patch.allowPhoneReveal !== undefined
      ? { allowPhoneReveal: patch.allowPhoneReveal }
      : {}),
    ...(nextPhotos ? { photos: nextPhotos, coverUrl: nextPhotos[0] ?? null } : {}),
  });

  return NextResponse.json({ ok: true });
}
