'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';

const CONSENT_KEY = 'alisales_gallery_permission_granted';

function hasConsent(): boolean {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * One-time gallery consent. The browser's file picker is the real permission
 * boundary; this custom sheet exists only so the first upload explains why the
 * picker is opening. Consent is remembered across every upload surface.
 */
export function useGalleryPicker() {
  const [pending, setPending] = useState<(() => void) | null>(null);

  const request = (openPicker: () => void) => {
    if (hasConsent()) {
      openPicker();
      return;
    }
    setPending(() => openPicker);
  };

  const allow = () => {
    try {
      window.localStorage.setItem(CONSENT_KEY, '1');
    } catch {
      // Private mode: the native picker still works for this session.
    }
    const action = pending;
    setPending(null);
    action?.();
  };

  return {
    pending: pending !== null,
    request,
    allow,
    cancel: () => setPending(null),
  };
}

export function GalleryPermissionDialog({
  open,
  onAllow,
  onCancel,
}: {
  open: boolean;
  onAllow: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('دسترسی به گالری', 'Gallery access')}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-3 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-line bg-card p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cta-soft text-cta">
          <Icon name="camera" size={22} />
        </span>
        <h2 className="mt-3 text-base font-extrabold text-ink">
          {t('اجازه دسترسی به گالری', 'Allow gallery access')}
        </h2>
        <p className="mt-1 text-xs leading-6 text-muted">
          {t(
            'برای انتخاب عکس یا ویدیو، یک بار اجازه می‌دهید و از این به بعد مستقیم گالری باز می‌شود.',
            'Allow once and the gallery will open directly on every future upload.',
          )}
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onAllow} className="btn-cta flex-1 text-sm">
            {t('اجازه و انتخاب', 'Allow and choose')}
          </button>
          <button type="button" onClick={onCancel} className="btn-ghost text-sm">
            {t('انصراف', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
