'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  BUSINESS_TYPE_LABELS,
  PROFILE_MODE_LABELS,
  accountTypes,
  businessTypes,
  safeNextPath,
  type AccountType,
  type BusinessType,
} from '@alisales/schemas';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

const ACCOUNT_TYPE_EN: Record<AccountType, string> = {
  individual: 'Personal account',
  showroom: 'Business account',
};

/**
 * Phone + OTP login (S2 / C4).
 *
 * Step 1 asks for the mobile number. Step 2 verifies the six-digit code and,
 * for a phone seen for the first time, also collects the display name and the
 * account type (فردی / نمایشگاه). There is no buyer/seller role.
 *
 * The code is never echoed back by the API: in development it is printed in
 * the server console only. One explicit exception exists for the owner demo:
 * when the deployment runs without SMS/Supabase and `NEXT_PUBLIC_DEMO_OTP_HINT`
 * is on, the API also returns `demoCode` and the code step shows it in a subtle
 * demo notice. That decision is the server's alone, so this form simply renders
 * the notice whenever a code came back — a hosted deployment never sends one.
 */

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useSearchParams();
  // Open-redirect guard: only internal paths survive; anything else goes to /.
  const next = safeNextPath(params.get('next'));

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  // «ورود با رمز عبور» is the fast path for a returning user; the SMS code
  // stays one tab away and is still the only way to create an account.
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [businessType, setBusinessType] = useState<BusinessType>('car-dealer');
  const [needsProfile, setNeedsProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  async function post(url: string, body: unknown): Promise<{ status: number; data: Record<string, unknown> }> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, data };
  }

  async function requestCode(event?: FormEvent<HTMLFormElement>): Promise<void> {
    event?.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { status, data } = await post('/api/auth/otp', { phone });
      if (status === 202) {
        setStep('code');
        setNeedsProfile(Boolean(data.needsProfile));
        const hint = typeof data.demoCode === 'string' ? data.demoCode : null;
        setDemoCode(hint);
        setNotice(
          hint
            ? t('کد ورود دمو ساخته شد.', 'Demo sign-in code created.')
            : t('کد تأیید ارسال شد.', 'Verification code sent.'),
        );
        setWait(60);
        return;
      }
      setError(
        String(
          data.error ??
            t('ارسال کد ناموفق بود؛ دوباره تلاش کنید.', 'Could not send the code; try again.'),
        ),
      );
    } catch {
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not connect to the server.'));
    } finally {
      setBusy(false);
    }
  }

  async function passwordLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { status, data } = await post('/api/auth/password', { phone, password });
      if (status === 200) {
        router.push(next.startsWith('/login') ? '/' : next);
        router.refresh();
        return;
      }
      setError(String(data.error ?? t('ورود ناموفق بود.', 'Sign-in failed.')));
    } catch {
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not connect to the server.'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const { status, data } = await post('/api/auth/verify', {
        phone,
        code,
        displayName: needsProfile ? displayName : undefined,
        accountType: needsProfile ? accountType : undefined,
        businessType: needsProfile && accountType === 'showroom' ? businessType : undefined,
      });
      if (status === 200) {
        // Never bounce back into the login screen (a `?next=/login` hand-off
        // would otherwise loop the user through the form again).
        router.push(next.startsWith('/login') ? '/' : next);
        router.refresh();
        return;
      }
      setError(String(data.error ?? t('ورود ناموفق بود.', 'Sign-in failed.')));
    } catch {
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not connect to the server.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-card border border-line bg-card p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cta-soft text-ink">
          <Icon name="user" size={20} />
        </span>
        <div>
          <h1 className="text-lg font-extrabold">{t('ورود به حساب', 'Sign in')}</h1>
          <p className="text-xs text-muted">
            {t('ورود با کد پیامکی یا رمز عبور', 'Sign in with an SMS code or password')}
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label={t('روش ورود', 'Sign-in method')}
        className="mt-5 grid grid-cols-2 gap-1 rounded-card border border-line bg-page p-1"
      >
        {(
          [
            { key: 'otp', label: t('کد پیامکی', 'SMS code') },
            { key: 'password', label: t('رمز عبور', 'Password') },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={mode === tab.key}
            onClick={() => {
              setMode(tab.key);
              setError(null);
              setNotice(null);
              setStep('phone');
              setDemoCode(null);
            }}
            className={`rounded-field px-3 py-2 text-sm font-extrabold transition ${
              mode === tab.key ? 'bg-cta-soft text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'password' ? (
        <form onSubmit={(e) => void passwordLogin(e)} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="pw-phone" className="label">
              {t('شماره موبایل', 'Mobile number')}
            </label>
            <input
              id="pw-phone"
              dir="ltr"
              inputMode="tel"
              autoComplete="username"
              className="field text-center tracking-widest"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09123456789"
              required
            />
          </div>
          <div>
            <label htmlFor="pw" className="label">
              {t('رمز عبور', 'Password')}
            </label>
            <input
              id="pw"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              className="field text-center tracking-widest"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <p className="hint mt-1">
              {t(
                'رمز عبور را در «تنظیمات حساب» تعیین کنید؛ اگر رمزی نساخته‌اید، از کد پیامکی وارد شوید.',
                'Set a password in Account settings; if you have not created one, sign in with an SMS code.',
              )}
            </p>
          </div>

          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-cta w-full text-sm disabled:opacity-60">
            {busy
              ? t('در حال ورود…', 'Signing in…')
              : t('ورود با رمز عبور', 'Sign in with password')}
          </button>

          <Link
            href="/profile/settings"
            className="block text-center text-xs font-bold text-muted underline"
          >
            {t('تعیین یا تغییر رمز عبور', 'Set or change password')}
          </Link>
        </form>
      ) : step === 'phone' ? (
        <form onSubmit={(e) => void requestCode(e)} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="phone" className="label">
              {t('شماره موبایل', 'Mobile number')}
            </label>
            <input
              id="phone"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              className="field text-center tracking-widest"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09123456789"
              required
            />
            <p className="hint mt-1">
              {t('ارقام فارسی یا انگلیسی، با یا بدون +98', 'Persian or Latin digits, with or without +98')}
            </p>
          </div>

          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-cta w-full text-sm disabled:opacity-60">
            {busy
              ? t('در حال ارسال…', 'Sending…')
              : t('دریافت کد تأیید', 'Get verification code')}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void verify(e)} className="mt-6 space-y-4" noValidate>
          <p className="text-sm text-muted">
            {t('کد شش‌رقمی ارسال‌شده به', 'Enter the six-digit code sent to')}{' '}
            <span dir="ltr" className="font-bold text-ink">{phone}</span>.
          </p>

          <div>
            <label htmlFor="code" className="label">
              {t('کد تأیید', 'Verification code')}
            </label>
            <input
              id="code"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="field text-center text-xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="------"
              required
            />
          </div>

          {demoCode && (
            <div
              role="status"
              className="rounded-field border border-dashed border-cta bg-cta-soft px-3 py-2 text-xs leading-6 font-bold text-ink"
            >
              {t(
                'حالت دمو — پیامک واقعی ارسال نمی‌شود. کد ورود:',
                'Demo mode — no real SMS is sent. Sign-in code:',
              )}{' '}
              <span dir="ltr" className="tracking-[0.3em]">
                {demoCode}
              </span>
            </div>
          )}

          {needsProfile && (
            <div className="space-y-4 rounded-field border border-line bg-page p-3">
              <p className="text-sm font-bold">
                {t('تکمیل حساب', 'Complete your account')}
              </p>
              <div>
                <label htmlFor="displayName" className="label">
                  {t('نام نمایشی', 'Display name')}
                </label>
                <input
                  id="displayName"
                  className="field"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('نام شما یا نام نمایشگاه', 'Your name or showroom name')}
                  required
                />
              </div>
              <fieldset>
                <legend className="label">{t('نوع حساب', 'Account type')}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {accountTypes.map((type) => (
                    <label
                      key={type}
                      className={`flex cursor-pointer items-center gap-2 rounded-field border p-3 text-sm font-bold transition ${
                        accountType === type
                          ? 'border-cta bg-cta-soft text-ink'
                          : 'border-line bg-card text-muted'
                      }`}
                    >
                      <input
                        type="radio"
                        name="accountType"
                        value={type}
                        checked={accountType === type}
                        onChange={() => setAccountType(type)}
                      />
                      {t(
                        type === 'showroom'
                          ? PROFILE_MODE_LABELS.business
                          : PROFILE_MODE_LABELS.personal,
                        ACCOUNT_TYPE_EN[type],
                      )}
                    </label>
                  ))}
                </div>
                {accountType === 'showroom' && (
                  <div className="mt-3">
                    <label className="label" htmlFor="business-type">
                      {t('نوع کسب‌وکار', 'Business type')}
                    </label>
                    <select
                      id="business-type"
                      className="field"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                    >
                      {businessTypes.map((type) => (
                        <option key={type} value={type}>
                          {t(BUSINESS_TYPE_LABELS[type], type)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </fieldset>
            </div>
          )}

          {notice && <p className="text-xs font-bold text-note">{notice}</p>}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-cta w-full text-sm disabled:opacity-60">
            {busy ? t('در حال بررسی…', 'Checking…') : t('ورود', 'Sign in')}
          </button>

          <button
            type="button"
            onClick={() => void requestCode()}
            disabled={busy || wait > 0}
            className="w-full text-center text-xs font-bold text-muted disabled:opacity-60"
          >
            {wait > 0
              ? t(
                  `ارسال دوباره کد تا ${wait} ثانیه`,
                  `Resend code in ${wait} seconds`,
                )
              : t('ارسال دوباره کد', 'Resend code')}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('phone');
              setCode('');
              setDemoCode(null);
              setError(null);
              setNotice(null);
            }}
            className="w-full text-center text-xs font-bold text-faint"
          >
            {t('تغییر شماره موبایل', 'Change mobile number')}
          </button>
        </form>
      )}
    </div>
  );
}
