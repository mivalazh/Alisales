import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * DELETE /api/stories/{id} — the author removes their own story.
 *
 * The route is the only client-facing path that deletes a story, so these
 * tests pin its authority model: no session answers 401, a signed-in account
 * that does not own the row answers 403 and deletes nothing, and the author's
 * own request removes the row and its stored media exactly once.
 */

const fake = vi.hoisted(() => ({
  session: null as { sub: string; phone: string; displayName: string; accountType: string } | null,
  story: null as { id: string; authorId: string; mediaUrl: string } | null,
  readError: null as Error | null,
  deleteError: null as Error | null,
  storyById: vi.fn(),
  deleteStorySubmission: vi.fn(),
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: async () => fake.session,
}));

vi.mock('@/lib/data/platform-store', () => ({
  storyById: (id: string) => fake.storyById(id),
  deleteStorySubmission: (id: string) => fake.deleteStorySubmission(id),
}));

const { DELETE } = await import('../apps/web/app/api/stories/[id]/route');

const OWNER = { sub: 'user-owner', phone: '09120000001', displayName: 'مالک', accountType: 'individual' };
const STRANGER = { sub: 'user-other', phone: '09120000002', displayName: 'دیگری', accountType: 'individual' };

function call(id: string) {
  return DELETE(new Request(`http://localhost/api/stories/${id}`, { method: 'DELETE' }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  fake.session = null;
  fake.story = { id: 'story-1', authorId: OWNER.sub, mediaUrl: '/api/media/story-media/user-owner/1.webp' };
  fake.readError = null;
  fake.deleteError = null;
  fake.storyById = vi.fn(async (id: string) => {
    if (fake.readError) throw fake.readError;
    return fake.story && fake.story.id === id ? fake.story : null;
  });
  fake.deleteStorySubmission = vi.fn(async () => {
    if (fake.deleteError) throw fake.deleteError;
    fake.story = null;
  });
});

describe('DELETE /api/stories/[id]', () => {
  it('answers 401 for a signed-out visitor and deletes nothing', async () => {
    const response = await call('story-1');

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
    expect(fake.storyById).not.toHaveBeenCalled();
    expect(fake.deleteStorySubmission).not.toHaveBeenCalled();
  });

  it('answers 403 when the story belongs to another account', async () => {
    fake.session = STRANGER;

    const response = await call('story-1');

    expect(response.status).toBe(403);
    expect(fake.deleteStorySubmission).not.toHaveBeenCalled();
    expect(fake.story).not.toBeNull();
  });

  it('answers 404 for an unknown story', async () => {
    fake.session = OWNER;

    const response = await call('missing');

    expect(response.status).toBe(404);
    expect(fake.deleteStorySubmission).not.toHaveBeenCalled();
  });

  it('answers 200 for the author and cleans up the row and its media', async () => {
    fake.session = OWNER;

    const response = await call('story-1');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(fake.deleteStorySubmission).toHaveBeenCalledTimes(1);
    expect(fake.deleteStorySubmission).toHaveBeenCalledWith('story-1');
  });

  it('answers 500 and reports no success when cleanup fails', async () => {
    fake.session = OWNER;
    fake.deleteError = new Error('storage unavailable');

    const response = await call('story-1');

    expect(response.status).toBe(500);
    const body = (await response.json()) as { ok?: boolean };
    expect(body.ok).not.toBe(true);
  });
});
