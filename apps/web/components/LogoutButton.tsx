'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Signs the account out and returns to the catalog. */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

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
      className="btn-ghost w-full text-sm text-bad disabled:opacity-60"
    >
      {busy ? 'در حال خروج…' : 'خروج از حساب'}
    </button>
  );
}
