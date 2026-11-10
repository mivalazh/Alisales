'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';

type Kind = 'brand' | 'ticket';

/**
 * Support form for both flows — «درخواست افزودن خودرو یا برند جدید» and
 * «پشتیبانی و ثبت تیکت». One component, one endpoint: the request is stored
 * server-side so support can follow up.
 */
export function SupportForm({ kind }: { kind: Kind }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;

    const form = new FormData(event.currentTarget);
    const payload = {
      kind,
      name: String(form.get('name') ?? '').trim(),
      contact: String(form.get('contact') ?? '').trim(),
      model: String(form.get('model') ?? '').trim(),
      message: String(form.get('message') ?? '').trim(),
    };

    setStatus('sending');
    setError('');
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          data.error ?? t('ارسال درخواست انجام نشد. دوباره تلاش کنید.', 'Could not submit the request. Please try again.'),
        );
        setStatus('error');
        return;
      }
      setStatus('done');
      event.currentTarget.reset();
    } catch {
      setError(
        t('ارتباط برقرار نشد. اتصال خود را بررسی کنید.', 'Could not connect. Please check your connection.'),
      );
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-card border border-line bg-card p-6 text-center">
        <p className="font-extrabold">{t('درخواست شما ثبت شد.', 'Your request has been submitted.')}</p>
        <p className="mt-2 text-sm text-muted">
          {t(
            'شماره پیگیری برای شما نگه داشته شد؛ کارشناسان ما در ساعات کاری پاسخ می‌دهند.',
            'A reference number has been saved for you; our team will reply during support hours.',
          )}
        </p>
        <button type="button" onClick={() => setStatus('idle')} className="btn-ghost mt-4 text-sm">
          {t('ثبت درخواست دیگر', 'Submit another request')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-card border border-line bg-card p-4 sm:p-6">
      <div>
        <label className="label" htmlFor="support-name">
          {t('نام و نام خانوادگی', 'Full name')}
        </label>
        <input id="support-name" name="name" required minLength={2} maxLength={80} className="field" />
      </div>

      <div>
        <label className="label" htmlFor="support-contact">
          {t('شماره موبایل یا ایمیل', 'Mobile number or email')}
        </label>
        <input
          id="support-contact"
          name="contact"
          required
          minLength={5}
          maxLength={80}
          dir="ltr"
          className="field"
        />
      </div>

      {kind === 'brand' ? (
        <div>
          <label className="label" htmlFor="support-model">
            {t('خودرو یا برند مورد نظر', 'Vehicle or brand')}
          </label>
          <input
            id="support-model"
            name="model"
            required
            maxLength={80}
            placeholder={t('مثلاً لکسوس LX 600', 'e.g. Lexus LX 600')}
            className="field"
          />
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="support-message">
          {kind === 'brand'
            ? t('توضیح درخواست', 'Request details')
            : t('متن تیکت', 'Ticket message')}
        </label>
        <textarea
          id="support-message"
          name="message"
          required
          minLength={5}
          maxLength={1200}
          rows={5}
          className="field"
        />
      </div>

      {status === 'error' && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn-cta w-full text-sm" disabled={status === 'sending'}>
        {status === 'sending'
          ? t('در حال ارسال…', 'Sending...')
          : t('ارسال درخواست', 'Submit request')}
      </button>
    </form>
  );
}
