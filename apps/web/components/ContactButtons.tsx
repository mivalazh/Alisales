'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';

/**
 * Detail-page contact actions (C8):
 *  - Sold listing: the chat action is disabled and reads «این آگهی فروخته شده
 *    است»; no phone action is rendered at all.
 *  - No phone (show_phone off or hidden server-side): only the full-width chat
 *    button — never a call button.
 *  - Otherwise phone, when the server returned one, plus chat.
 */
export function ContactButtons({
  listingId,
  slug,
  phone,
  sold,
}: {
  listingId: string;
  slug: string;
  phone: string | null;
  sold: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startChat(): Promise<void> {
    if (busy || sold) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.status === 401) {
        router.push(`/login?next=/listing/${slug}`);
        return;
      }
      if (res.ok && body.id) {
        router.push(`/chats/${body.id}`);
        return;
      }
      setError(body.error ?? 'شروع گفتگو ناموفق بود.');
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }

  if (sold) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          disabled
          className="btn-cta w-full cursor-not-allowed text-sm opacity-60"
        >
          <Icon name="message" size={18} />
          این آگهی فروخته شده است
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void startChat()}
        disabled={busy}
        className="btn-cta w-full text-sm disabled:opacity-60"
      >
        <Icon name="message" size={18} />
        {busy ? 'در حال باز کردن گفتگو…' : 'چت با آگهی‌دهنده'}
      </button>

      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={() => {
            // «نمایش شماره» is its own owner counter (C2).
            void fetch('/api/phone-reveal', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ listingId }),
              keepalive: true,
            }).catch(() => null);
          }}
          className="btn-ghost w-full text-sm"
        >
          <Icon name="phone" size={18} />
          تماس تلفنی
        </a>
      )}

      {error && (
        <p className="text-center text-xs font-bold text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
