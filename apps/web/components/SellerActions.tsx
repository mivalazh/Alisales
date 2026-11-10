'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();
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
      setNote(data.error ?? t('شروع گفتگو ممکن نشد.', 'Could not start the conversation.'));
    } catch {
      setNote(t('ارتباط با سرور برقرار نشد.', 'Could not connect to the server.'));
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
      setNote(
        t(
          'فروشنده شماره‌ی تماس را برای این آگهی نمایش نداده است.',
          'The seller has not shared a phone number for this listing.',
        ),
      );
    } catch {
      setNote(t('ارتباط با سرور برقرار نشد.', 'Could not connect to the server.'));
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
        setNote(t('نشانی پروفایل کپی شد.', 'Profile link copied.'));
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
            {t('ویرایش پروفایل', 'Edit profile')}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => void message()}
            disabled={busy !== null || !listingId}
            className="btn-cta text-sm disabled:opacity-50"
          >
            <Icon name="message" size={16} />
            {busy === 'chat'
              ? t('در حال باز کردن…', 'Opening…')
              : t('پیام دادن', 'Message')}
          </button>
        )}

        <button
          type="button"
          onClick={() => void call()}
          disabled={busy !== null || !canCall || isOwner}
          className="btn-ghost text-sm disabled:opacity-50"
          title={
            canCall
              ? undefined
              : t(
                  'شماره‌ی تماس برای این فروشنده در دسترس نیست',
                  'A phone number is not available for this seller',
                )
          }
        >
          <Icon name="phone" size={16} />
          {phone ? <bdi>{phone}</bdi> : t('تماس', 'Call')}
        </button>

        <button
          type="button"
          onClick={() => void share()}
          disabled={busy !== null}
          className="btn-ghost text-sm disabled:opacity-50"
        >
          <Icon name="share" size={16} />
          {t('اشتراک‌گذاری', 'Share')}
        </button>
      </div>

      {note && (
        <p className="mt-2 text-xs font-bold text-muted" role="status">
          {note}
        </p>
      )}
      <span className="sr-only">
        {t('شناسه فروشنده', 'Seller ID')} {sellerId}
      </span>
    </div>
  );
}
