'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from './Icon';

/**
 * Set or change the account password.
 *
 * A first password needs only the session (it was opened with the SMS code);
 * changing one asks for the current password. The SMS code keeps working, so a
 * forgotten password is never a locked account.
 */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState(hasPassword);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setSaved(false);
    if (password !== confirm) {
      setError('تکرار رمز عبور یکسان نیست.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password, currentPassword: currentPassword || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'ذخیره رمز عبور انجام نشد.');
        return;
      }
      setSaved(true);
      setExisting(true);
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-3" noValidate>
      {existing && (
        <div>
          <label htmlFor="current-password" className="label">
            رمز عبور فعلی
          </label>
          <input
            id="current-password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            className="field"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="new-password" className="label">
            {existing ? 'رمز عبور جدید' : 'رمز عبور'}
          </label>
          <input
            id="new-password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="حداقل ۸ نویسه، حرف و رقم"
            required
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="label">
            تکرار رمز عبور
          </label>
          <input
            id="confirm-password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            className="field"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-xs font-extrabold text-[var(--color-success-fg)]" role="status">
          رمز عبور ذخیره شد؛ از این پس می‌توانید با رمز وارد شوید.
        </p>
      )}

      <button type="submit" className="btn-cta text-sm" disabled={busy}>
        <Icon name="check" size={16} />
        {busy ? 'در حال ذخیره…' : existing ? 'تغییر رمز عبور' : 'تعیین رمز عبور'}
      </button>
    </form>
  );
}
