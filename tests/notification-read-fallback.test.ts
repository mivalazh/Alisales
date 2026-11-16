import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabase = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../apps/web/lib/data/s2-store', () => ({
  admin: () => ({ rpc: supabase.rpc, from: supabase.from }),
}));

import { markNotificationsRead } from '../apps/web/lib/data/notification-store';

describe('notification read marker fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T12:00:00.000Z'));
    supabase.rpc.mockReset();
    supabase.from.mockReset();
    supabase.upsert.mockReset();
    supabase.from.mockReturnValue({ upsert: supabase.upsert });
    supabase.upsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('upserts notification_reads directly when mark_notification_read is missing', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'function public.mark_notification_read(uuid) does not exist' },
    });

    const readAt = await markNotificationsRead('user-1');

    expect(supabase.rpc).toHaveBeenCalledWith('mark_notification_read', {
      p_user: 'user-1',
    });
    expect(supabase.from).toHaveBeenCalledWith('notification_reads');
    expect(supabase.upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', read_at: '2026-11-16T12:00:00.000Z' },
      { onConflict: 'user_id' },
    );
    expect(readAt).toBe('2026-11-16T12:00:00.000Z');
  });

  it('does not write the table when the RPC succeeds', async () => {
    supabase.rpc.mockResolvedValue({
      data: '2026-11-16T11:30:00+00:00',
      error: null,
    });

    const readAt = await markNotificationsRead('user-1');

    expect(readAt).toBe('2026-11-16T11:30:00.000Z');
    expect(supabase.upsert).not.toHaveBeenCalled();
  });
});
