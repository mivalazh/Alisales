'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

/**
 * Set or change the account password.
 *
 * A first password needs only the session (it was opened with the SMS code);
 * changing one asks for the current password. The SMS code keeps working, so a
 * forgotten password is never a locked account.
 */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useI18n();
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
      setError(t('تکرار رمز عبور یکسان نیست.', 'The passwords do not match.'));
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
        setError(data.error ?? t('ذخیره رمز عبور انجام نشد.', 'Could not save the password.'));
        return;
      }
      setSaved(true);
      setExisting(true);
      setCurrentPassword('');
      setPassword('');
      setConfirm('');
    } catch {
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not connect to the server.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-3 space-y-3" noValidate>
      {existing && (
        <div>
          <label htmlFor="current-password" className="label">
            {t('رمز عبور فعلی', 'Current password')}
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
            {existing ? t('رمز عبور جدید', 'New password') : t('رمز عبور', 'Password')}
          </label>
          <input
            id="new-password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('حداقل ۸ نویسه، حرف و رقم', 'At least 8 characters, letters and digits')}
            required
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="label">
            {t('تکرار رمز عبور', 'Confirm password')}
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
          {t(
            'رمز عبور ذخیره شد؛ از این پس می‌توانید با رمز وارد شوید.',
            'Password saved; you can now sign in with it.',
          )}
        </p>
      )}

      <button type="submit" className="btn-cta text-sm" disabled={busy}>
        <Icon name="check" size={16} />
        {busy
          ? t('در حال ذخیره…', 'Saving…')
          : existing
            ? t('تغییر رمز عبور', 'Change password')
            : t('تعیین رمز عبور', 'Set password')}
      </button>
    </form>
  );
}
