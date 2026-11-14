import { NextResponse } from 'next/server';
import { adminSession } from '@/lib/admin/guard';
import {
  actionReport,
  bumpListing,
  decideReport,
  decideStory,
  decideVerification,
  featureListing,
  markInspected,
  pauseListing,
  removeListing,
  type ModerationActionResult,
} from '@/lib/data/moderation';
import {
  decideStorySubmission,
  deleteStorySubmission,
  setStoryPaidGuard,
  updateInspection,
  type InspectionBooking,
} from '@/lib/data/platform-store';

/**
 * POST /api/admin — owner moderation actions.
 *
 * Authorization happens here, on the server, from the signed session and
 * `ADMIN_PHONES`; the browser only names the action and the row. Guests get
 * 401 (so the UI can send them to login) and signed-in non-admins get 403.
 *
 * Body: { action, id, listingId? }
 *   report-dismiss | report-act | verification-approve | verification-reject |
 *   story-approve | story-reject | listing-pause | listing-remove
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: 'دسترسی ندارید.' }, { status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const body = raw as {
    action?: unknown;
    id?: unknown;
    listingId?: unknown;
    featured?: unknown;
    enabled?: unknown;
    status?: unknown;
  };
  const action = typeof body.action === 'string' ? body.action : '';
  const id = typeof body.id === 'string' ? body.id : '';
  const listingId = typeof body.listingId === 'string' ? body.listingId : '';

  let result: ModerationActionResult;
  switch (action) {
    case 'report-dismiss':
      result = await decideReport(id, 'dismissed');
      break;
    case 'report-act':
      if (!listingId) return NextResponse.json({ error: 'آگهی گزارش‌شده پیدا نشد.' }, { status: 400 });
      result = await actionReport(id, listingId);
      break;
    case 'verification-approve':
      result = await decideVerification(id, 'approved');
      break;
    case 'verification-reject':
      result = await decideVerification(id, 'rejected');
      break;
    case 'story-approve':
      result = await decideStory(id, 'approved');
      break;
    case 'story-reject':
      result = await decideStory(id, 'rejected');
      break;
    case 'listing-pause':
      result = await pauseListing(id);
      break;
    case 'listing-remove':
      result = await removeListing(id);
      break;
    case 'listing-feature':
      result = await featureListing(id, Boolean(body.featured));
      break;
    case 'listing-bump':
      result = await bumpListing(id);
      break;
    case 'story-submission-approve':
      await decideStorySubmission(id, 'approved');
      result = { ok: true };
      break;
    case 'story-submission-reject':
      await decideStorySubmission(id, 'rejected');
      result = { ok: true };
      break;
    case 'story-submission-delete':
      await deleteStorySubmission(id);
      result = { ok: true };
      break;
    case 'story-guard-toggle':
      await setStoryPaidGuard(Boolean(body.enabled));
      result = { ok: true };
      break;
    case 'inspection-update': {
      const status = body.status;
      if (
        status !== 'pending' &&
        status !== 'confirmed' &&
        status !== 'done' &&
        status !== 'cancelled'
      ) {
        return NextResponse.json({ error: 'وضعیت نوبت نامعتبر است.' }, { status: 400 });
      }
      const booking = await updateInspection(id, status as InspectionBooking['status']);
      if (!booking) return NextResponse.json({ error: 'نوبت پیدا نشد.' }, { status: 400 });
      if (status === 'confirmed' || status === 'done') await markInspected(booking.listingSlug);
      result = { ok: true };
      break;
    }
    default:
      return NextResponse.json({ error: 'این عملیات شناخته نشد.' }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'عملیات انجام نشد.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
