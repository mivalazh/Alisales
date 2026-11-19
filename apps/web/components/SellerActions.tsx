'use client';

import { useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

/**
 * The actions on a public seller profile.
 *
 * Messaging and calling are deliberately absent: both already live on every
 * listing card page, where the seller and the revealed phone number belong to
 * a specific ad. The profile stays a clean identity surface — share it, or
 * edit it when it is yours.
 */
export function SellerActions({
  sellerId,
  name,
  isOwner,
}: {
  sellerId: string;
  name: string;
  isOwner: boolean;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function share(): Promise<void> {
    if (busy) return;
    setBusy(true);
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
      setBusy(false);
    }
  }

  return (
    <>
      {/* `contents` lets the button join the profile's action grid directly, so
          it lines up with the follow control. */}
      <div className="contents">
        {isOwner ? (
          <a href="/profile" className="btn-ghost w-full text-sm sm:w-auto">
            <Icon name="pencil" size={16} />
            {t('ویرایش پروفایل', 'Edit profile')}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => void share()}
            disabled={busy}
            className="btn-ghost w-full text-sm disabled:opacity-50 sm:w-auto"
          >
            <Icon name="share" size={16} />
            {t('اشتراک‌گذاری', 'Share')}
          </button>
        )}
      </div>

      {note && (
        <p className="col-span-2 mt-1 text-xs font-bold text-muted sm:w-full" role="status">
          {note}
        </p>
      )}
      <span className="sr-only">
        {t('شناسه فروشنده', 'Seller ID')} {sellerId}
      </span>
    </>
  );
}
