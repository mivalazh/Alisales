'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BUSINESS_TYPE_LABELS,
  PROFILE_MODE_LABELS,
  businessTypes,
  profileModes,
  type BusinessType,
  type ProfileMode,
} from '@alisales/schemas';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';

/** Personal vs business profile switch, with the business sub-type. */
export function AccountModeForm({
  initialMode,
  initialBusinessType,
}: {
  initialMode: ProfileMode;
  initialBusinessType: BusinessType | null;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [mode, setMode] = useState<ProfileMode>(initialMode);
  const [businessType, setBusinessType] = useState<BusinessType>(
    initialBusinessType ?? 'car-dealer',
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profileMode: mode,
          businessType: mode === 'business' ? businessType : null,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? t('ذخیره نوع حساب ناموفق بود.', 'Could not save the account type.'));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not reach the server.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-extrabold">{t('نوع حساب', 'Account type')}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {t(
              'حساب شخصی خصوصی می‌ماند؛ حساب کسب‌وکار یک صفحه عمومی با کاور، بایو، آگهی‌ها، استوری و امتیاز دارد.',
              'Personal stays private; business becomes a public page with cover, bio, inventory, stories and ratings.',
            )}
          </p>
        </div>
        {saved && <span className="text-xs font-extrabold text-emerald-600">{t('ذخیره شد.', 'Saved.')}</span>}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {profileModes.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            aria-pressed={mode === item}
            className={`flex items-start gap-3 rounded-2xl border p-3 text-start transition ${
              mode === item
                ? 'border-cta bg-cta-soft'
                : 'border-line bg-page/50 hover:border-line-strong'
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-ink">
              <Icon name={item === 'personal' ? 'user' : 'badgeCheck'} size={18} />
            </span>
            <span>
              <span className="block text-sm font-extrabold text-ink">
                {t(PROFILE_MODE_LABELS[item])}
              </span>
              <span className="mt-0.5 block text-[11px] leading-5 text-muted">
                {item === 'personal'
                  ? t('فقط آگهی‌ها، ذخیره‌شده‌ها و تنظیمات', 'Listings, saved ads and settings only')
                  : t('صفحه عمومی برای مشتریان و خریداران', 'A public page for customers and buyers')}
              </span>
            </span>
          </button>
        ))}
      </div>

      {mode === 'business' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {businessTypes.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setBusinessType(item)}
              aria-pressed={businessType === item}
              className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-extrabold transition ${
                businessType === item
                  ? 'border-cta bg-cta text-ink'
                  : 'border-line bg-card text-muted hover:border-line-strong'
              }`}
            >
              {t(BUSINESS_TYPE_LABELS[item])}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="btn-cta mt-3 text-sm disabled:opacity-60"
      >
        {busy ? t('در حال ذخیره…', 'Saving...') : t('ذخیره نوع حساب', 'Save account type')}
      </button>
    </section>
  );
}
