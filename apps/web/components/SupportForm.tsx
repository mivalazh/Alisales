'use client';

import { useState } from 'react';

type Kind = 'brand' | 'ticket';

/**
 * Support form for both flows — «درخواست افزودن خودرو یا برند جدید» and
 * «پشتیبانی و ثبت تیکت». One component, one endpoint: the request is stored
 * server-side so support can follow up.
 */
export function SupportForm({ kind }: { kind: Kind }) {
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
        setError(data.error ?? 'ارسال درخواست انجام نشد. دوباره تلاش کنید.');
        setStatus('error');
        return;
      }
      setStatus('done');
      event.currentTarget.reset();
    } catch {
      setError('ارتباط برقرار نشد. اتصال خود را بررسی کنید.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-card border border-line bg-card p-6 text-center">
        <p className="font-extrabold">درخواست شما ثبت شد.</p>
        <p className="mt-2 text-sm text-muted">
          شماره پیگیری برای شما نگه داشته شد؛ کارشناسان ما در ساعات کاری پاسخ می‌دهند.
        </p>
        <button type="button" onClick={() => setStatus('idle')} className="btn-ghost mt-4 text-sm">
          ثبت درخواست دیگر
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-card border border-line bg-card p-4 sm:p-6">
      <div>
        <label className="label" htmlFor="support-name">
          نام و نام خانوادگی
        </label>
        <input id="support-name" name="name" required minLength={2} maxLength={80} className="field" />
      </div>

      <div>
        <label className="label" htmlFor="support-contact">
          شماره موبایل یا ایمیل
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
            خودرو یا برند مورد نظر
          </label>
          <input
            id="support-model"
            name="model"
            required
            maxLength={80}
            placeholder="مثلاً لکسوس LX 600"
            className="field"
          />
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="support-message">
          {kind === 'brand' ? 'توضیح درخواست' : 'متن تیکت'}
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
        {status === 'sending' ? 'در حال ارسال…' : 'ارسال درخواست'}
      </button>
    </form>
  );
}
