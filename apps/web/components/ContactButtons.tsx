'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState, type MouseEvent } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

/**
 * Detail-page contact actions (C8 / C2):
 *  - Sold listing: the chat action is disabled and reads «این آگهی فروخته شده
 *    است»; no phone action is rendered at all.
 *  - Phone hidden but the seller allows reveal: a «نمایش شماره تماس» CTA that
 *    records one `phone_reveal_events` row (after login) and then shows the
 *    number. Guests are sent to login first.
 *  - Phone visible: the call link records the same reveal event once.
 *
 * «گفتگوی جدید» and «نمایش شماره» stay separate counters: starting a chat
 * never touches the reveal counter and vice versa.
 */
export function ContactButtons({
  listingId,
  slug,
  phone,
  sold,
  revealable = false,
}: {
  listingId: string;
  slug: string;
  phone: string | null;
  sold: boolean;
  revealable?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shownPhone, setShownPhone] = useState<string | null>(phone);
  const recorded = useRef(false);

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
        router.push(`/login?next=${encodeURIComponent(pathname || `/listing/${slug}`)}`);
        return;
      }
      if (res.ok && body.id) {
        router.push(`/chats/${body.id}`);
        return;
      }
      setError(body.error ?? t('شروع گفتگو ناموفق بود.', 'Could not start the conversation.'));
    } catch {
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not connect to the server.'));
    } finally {
      setBusy(false);
    }
  }

  async function reveal(): Promise<string | null> {
    try {
      const res = await fetch('/api/phone-reveal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(pathname || `/listing/${slug}`)}`);
        return null;
      }
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        phone?: string | null;
        error?: string;
      } | null;
      if (!res.ok) {
        setError(body?.error ?? t('نمایش شماره ممکن نشد.', 'Could not display the number.'));
        return null;
      }
      return body?.phone ?? null;
    } catch {
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not connect to the server.'));
      return null;
    }
  }

  async function showPhone(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    const value = await reveal();
    setBusy(false);
    if (value) {
      recorded.current = true;
      setShownPhone(value);
      window.location.href = `tel:${value}`;
    }
  }

  function recordCall(event: MouseEvent<HTMLAnchorElement>): void {
    if (recorded.current) {
      event.preventDefault();
      recorded.current = false;
      return;
    }
    void fetch('/api/phone-reveal', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ listingId }),
      keepalive: true,
    }).catch(() => null);
  }

  if (sold) {
    return (
      <div className="space-y-2">
        <button type="button" disabled className="btn-cta w-full cursor-not-allowed text-sm opacity-60">
          <Icon name="message" size={18} />
          {t('این آگهی فروخته شده است', 'This listing has been sold')}
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
        {busy
          ? t('در حال باز کردن گفتگو…', 'Opening chat...')
          : t('چت با آگهی‌دهنده', 'Chat with seller')}
      </button>

      {shownPhone ? (
        <a href={`tel:${shownPhone}`} onClick={recordCall} className="btn-ghost w-full text-sm">
          <Icon name="phone" size={18} />
          {t('تماس تلفنی', 'Call')}
        </a>
      ) : revealable ? (
        <button
          type="button"
          onClick={() => void showPhone()}
          disabled={busy}
          className="btn-ghost w-full text-sm disabled:opacity-60"
        >
          <Icon name="phone" size={18} />
          {busy
            ? t('در حال نمایش شماره…', 'Showing number...')
            : t('نمایش شماره تماس', 'Show phone number')}
        </button>
      ) : null}

      {error && (
        <p className="text-center text-xs font-bold text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
