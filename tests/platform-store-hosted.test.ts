import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../apps/web/lib/data/s2-store', async () => {
  const { fakeAdmin } = await import('./helpers/fake-supabase');
  return { admin: fakeAdmin };
});

import {
  addInspection,
  addStory,
  adminSettings,
  decideStorySubmission,
  deleteStorySubmission,
  listInspections,
  listStories,
  setStoryPaidGuard,
  topFaqTopics,
  trackFaq,
  updateInspection,
} from '../apps/web/lib/data/platform-store';
import {
  createSupportRequest,
  findSupportByCode,
  listSupportRequests,
} from '../apps/web/lib/support-store';
import { storeStoryMedia } from '../apps/web/lib/data/media-store';
import { resetSocialDb, socialStorage, socialTables } from './helpers/fake-supabase';

const ALICE = '00000000-0000-0000-0000-00000000000c';

beforeAll(() => {
  vi.stubEnv('SUPABASE_URL', 'https://fake.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fake.supabase.co');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  resetSocialDb();
});

describe('platform flows hosted path', () => {
  it('persists stories, honours the paid guard and supports moderation', async () => {
    expect(await adminSettings()).toEqual({ storyPaidGuard: false });

    const approved = await addStory({
      title: 'Land Cruiser',
      mediaUrl: 'data:image/webp;base64,AAAA',
      mediaKind: 'image',
      authorId: ALICE,
      authorName: 'Alice',
      listingSlug: 'alice-car',
    });
    expect(approved.status).toBe('approved');
    expect((await listStories('approved')).map((story) => story.id)).toEqual([approved.id]);
    expect(socialTables.story_submissions[0]).toMatchObject({
      title: 'Land Cruiser',
      media_url: 'data:image/webp;base64,AAAA',
      author_id: ALICE,
    });

    await setStoryPaidGuard(true);
    const pending = await addStory({
      title: 'Pending story',
      mediaUrl: '/api/photos/story.webp',
      mediaKind: 'image',
      authorId: ALICE,
      authorName: 'Alice',
      listingSlug: null,
    });
    expect(pending.status).toBe('pending');
    expect((await listStories('approved')).map((story) => story.id)).not.toContain(pending.id);

    await decideStorySubmission(pending.id, 'approved');
    expect((await listStories('approved')).map((story) => story.id)).toContain(pending.id);

    await deleteStorySubmission(pending.id);
    expect((await listStories()).map((story) => story.id)).toEqual([approved.id]);
  });

  it('deletes the stored story object with its story row', async () => {
    const media = await storeStoryMedia({
      userId: ALICE,
      bytes: new Uint8Array([9, 9]),
      mime: 'image/webp',
      width: 900,
      height: 1600,
    });
    const story = await addStory({
      title: 'Cleanup story',
      mediaUrl: media.url,
      mediaKind: 'image',
      authorId: ALICE,
      authorName: 'Alice',
      listingSlug: null,
    });
    expect(socialStorage['story-media']?.has(media.path)).toBe(true);

    await deleteStorySubmission(story.id);
    expect(socialStorage['story-media']?.has(media.path)).toBe(false);
  });

  it('persists inspection bookings and status updates', async () => {
    const booking = await addInspection({
      name: 'مهدی رضایی',
      phone: '09120000000',
      date: '2026-11-20',
      time: '10:30',
      vehicle: 'Land Cruiser VXR',
      listingSlug: 'land-cruiser-kish',
      listingTitle: 'Land Cruiser VXR',
      note: null,
    });
    expect(booking.status).toBe('pending');
    expect(await listInspections()).toHaveLength(1);

    const updated = await updateInspection(booking.id, 'confirmed');
    expect(updated).toMatchObject({ id: booking.id, status: 'confirmed' });
    expect((await listInspections())[0]).toMatchObject({
      id: booking.id,
      status: 'confirmed',
      phone: '09120000000',
    });
    expect(await updateInspection('missing', 'done')).toBeNull();
  });

  it('persists support tickets and retrieves them by code', async () => {
    const ticket = await createSupportRequest({
      topic: 'advertising',
      name: 'Sam',
      contact: '09120000000',
      model: 'Cooperation',
      message: 'I would like to advertise.',
    });

    expect(ticket.status).toBe('answered');
    expect(ticket.code).toMatch(/^AS-[A-F0-9]{8}$/);
    await expect(findSupportByCode(ticket.code.toLowerCase())).resolves.toMatchObject({
      id: ticket.id,
      topic: 'advertising',
      reply: expect.any(String),
    });
    expect(await listSupportRequests()).toHaveLength(1);
    expect(socialTables.support_requests[0]).toMatchObject({
      code: ticket.code,
      contact: '09120000000',
    });
  });

  it('increments AI topic counters atomically and ranks them', async () => {
    for (let index = 0; index < 20; index += 1) await trackFaq('تست مشاوره خرید');
    expect(socialTables.ai_faq_counts).toEqual([
      expect.objectContaining({ topic: 'تست مشاوره خرید', count: 20 }),
    ]);

    const topics = await topFaqTopics(1);
    expect(topics).toEqual(['تست مشاوره خرید']);
  });
});
