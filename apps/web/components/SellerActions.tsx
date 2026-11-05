'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './Icon';

/**
 * The three actions on a public seller profile.
 *
 * پیام دادن opens (or finds) the conversation for the seller's first active
 * listing through the existing `/api/conversations` route, so the server still
 * resolves the seller from the listing. تماس reveals the number through the
 * same authenticated `/api/phone-reveal` flow the listing page uses. اشتراک‌گذاری
 * uses the native share sheet and falls back to the clipboard.
 */
export function SellerActions({
  sellerId,
  listingId,
  name,
  isOwner,
  canCall,
}: {
  sellerId: string;
  listingId: string | null;
  name: string;
  isOwner: boolean;
  canCall: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<'chat' | 'call' | 'share' | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function message(): Promise<void> {
    if (!listingId || busy) return;
    setBusy('chat');
    setNote(null);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.ok && data.id) {
        router.push(`/chats/${data.id}`);
        return;
      }
      setNote(data.error ?? 'شروع گفتگو ممکن نشد.');
    } catch {
      setNote('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(null);
    }
  }

  async function call(): Promise<void> {
    if (!listingId || busy) return;
    setBusy('call');
    setNote(null);
    try {
      const res = await fetch('/api/phone-reveal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ listingId }),
      });
      const data = (await res.json().catch(() => ({}))) as { phone?: string };
      if (res.ok && data.phone) {
        setPhone(data.phone);
        window.location.href = `tel:${data.phone}`;
        return;
      }
      setNote('فروشنده شماره‌ی تماس را برای این آگهی نمایش نداده است.');
    } catch {
      setNote('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(null);
    }
  }

  async function share(): Promise<void> {
    setBusy('share');
    setNote(null);
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setNote('نشانی پروفایل کپی شد.');
      }
    } catch {
      // The user dismissed the sheet — not an error worth reporting.
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {isOwner ? (
          <a href="/profile" className="btn-ghost text-sm">
            <Icon name="pencil" size={16} />
            ویرایش پروفایل
          </a>
        ) : (
          <button
            type="button"
            onClick={() => void message()}
            disabled={busy !== null || !listingId}
            className="btn-cta text-sm disabled:opacity-50"
          >
            <Icon name="message" size={16} />
            {busy === 'chat' ? 'در حال باز کردن…' : 'پیام دادن'}
          </button>
        )}

        <button
          type="button"
          onClick={() => void call()}
          disabled={busy !== null || !canCall || isOwner}
          className="btn-ghost text-sm disabled:opacity-50"
          title={canCall ? undefined : 'شماره‌ی تماس برای این فروشنده در دسترس نیست'}
        >
          <Icon name="phone" size={16} />
          {phone ? <bdi>{phone}</bdi> : 'تماس'}
        </button>

        <button
          type="button"
          onClick={() => void share()}
          disabled={busy !== null}
          className="btn-ghost text-sm disabled:opacity-50"
        >
          <Icon name="share" size={16} />
          اشتراک‌گذاری
        </button>
      </div>

      {note && (
        <p className="mt-2 text-xs font-bold text-muted" role="status">
          {note}
        </p>
      )}
      <span className="sr-only">شناسه فروشنده {sellerId}</span>
    </div>
  );
}
