'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';

/** Signs the account out and returns to the catalog. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
        router.push('/');
        router.refresh();
      }}
      className="w-full rounded-field border border-red-300 bg-red-50/70 px-3 py-2 text-sm font-bold text-red-600 transition hover:border-red-400 hover:bg-red-50 disabled:opacity-60 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60"
    >
      {busy ? t('در حال خروج…', 'Signing out…') : t('خروج از حساب کاربری', 'Sign out')}
    </button>
  );
}
