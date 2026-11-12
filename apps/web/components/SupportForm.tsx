'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { CarLoader } from './CarLoader';
import { pushLocalNotification } from '@/lib/local-notifications';

type Kind = 'brand' | 'ticket';
type Topic = 'technical' | 'advertising' | 'suggestion' | 'report';

const TOPICS: ReadonlyArray<{ value: Topic; fa: string; en: string }> = [
  { value: 'technical', fa: 'پشتیبانی و سوال فنی', en: 'Technical support' },
  { value: 'advertising', fa: 'درخواست همکاری و تبلیغات در سایت', en: 'Partnership & advertising' },
  { value: 'suggestion', fa: 'پیشنهاد برند یا قابلیت جدید', en: 'Suggest a brand or feature' },
  { value: 'report', fa: 'گزارش مشکل آگهی', en: 'Report a listing problem' },
];

const CODES_KEY = 'alisales-ticket-codes';

function rememberCode(code: string): void {
  try {
    const previous: unknown = JSON.parse(localStorage.getItem(CODES_KEY) ?? '[]');
    const list = Array.isArray(previous) ? previous.filter((v) => typeof v === 'string') : [];
    localStorage.setItem(CODES_KEY, JSON.stringify([code, ...list.filter((v) => v !== code)].slice(0, 8)));
  } catch {
    // private mode — the code is still shown on screen
  }
}

export function SupportForm({
  kind,
  initialTopic,
}: {
  kind: Kind;
  initialTopic?: Topic;
}) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string; reply: string | null } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const topic: Topic =
      kind === 'brand'
        ? 'suggestion'
        : (String(form.get('topic') ?? 'technical') as Topic);
    const payload = {
      kind,
      topic,
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
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        reply?: string | null;
      };
      if (!res.ok || !data.code) {
        setError(data.error ?? t('ارسال درخواست انجام نشد. دوباره تلاش کنید.', 'Could not submit. Please try again.'));
        setStatus('error');
        return;
      }
      rememberCode(data.code);
      setResult({ code: data.code, reply: data.reply ?? null });
      setStatus('done');
      pushLocalNotification({
        kind: 'ticket_reply',
        title: t('پاسخ تیکت پشتیبانی شما ثبت شد', 'Your support ticket has a reply'),
        body: t(
          `کد پیگیری ${data.code} — پاسخ تیم پشتیبانی آماده است.`,
          `Tracking code ${data.code} — the support team replied.`,
        ),
        href: '/support#my-tickets',
      });
      window.dispatchEvent(new CustomEvent('alisales:ticket-created'));
      formEl.reset();
    } catch {
      setError(t('ارتباط برقرار نشد. اتصال خود را بررسی کنید.', 'Could not connect. Check your connection.'));
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-card border border-ok/35 bg-card p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ok/12 text-ok">
            <span className="text-lg">✓</span>
          </span>
          <div>
            <p className="font-extrabold text-ink">{t('تیکت شما ثبت شد', 'Your ticket is in')}</p>
            {result?.code && (
              <p className="mt-0.5 text-[11px] font-bold text-muted" dir="ltr">
                {result.code}
              </p>
            )}
          </div>
        </div>
        {result?.reply && (
          <p className="mt-3 rounded-field bg-page px-3 py-2 text-xs leading-6 text-ink/80">
            {result.reply}
          </p>
        )}
        <p className="mt-2 text-xs leading-6 text-muted">
          {t(
            'کد پیگیری را نگه دارید؛ همین تیکت و پاسخ آن در بخش «تیکت‌های من» پایین همین صفحه قابل مشاهده است.',
            'Keep the code; this ticket and its reply appear in My tickets below.',
          )}
        </p>
        <button type="button" onClick={() => setStatus('idle')} className="btn-ghost mt-4 text-sm">
          {t('ثبت تیکت دیگر', 'Submit another ticket')}
        </button>
      </div>
    );
  }

  return (
    <form id="ticket" onSubmit={onSubmit} className="scroll-mt-24 space-y-3.5 rounded-card border border-line bg-card p-4 sm:p-6">
      <div>
        <p className="text-sm font-extrabold text-ink">
          {kind === 'brand' ? t('پیشنهاد برند یا قابلیت', 'Suggest a brand or feature') : t('ثبت تیکت و درخواست', 'Open a ticket')}
        </p>
        <p className="mt-1 text-xs leading-6 text-muted">
          {t(
            'هر تیکت یک کد پیگیری می‌گیرد و پاسخ تیم پشتیبانی همین‌جا ثبت می‌شود.',
            'Every ticket gets a tracking code and the reply appears right here.',
          )}
        </p>
      </div>

      {kind === 'ticket' && (
        <div>
          <label className="label" htmlFor="support-topic">
            {t('موضوع درخواست', 'Request topic')}
          </label>
          <select id="support-topic" name="topic" className="field" defaultValue={initialTopic ?? 'technical'}>
            {TOPICS.map((topic) => (
              <option key={topic.value} value={topic.value}>
                {lang === 'en' ? topic.en : topic.fa}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="support-name">{t('نام و نام خانوادگی', 'Full name')}</label>
          <input id="support-name" name="name" required minLength={2} maxLength={80} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="support-contact">{t('موبایل یا ایمیل', 'Mobile or email')}</label>
          <input id="support-contact" name="contact" required minLength={5} maxLength={80} dir="ltr" className="field" />
        </div>
      </div>

      {kind === 'brand' && (
        <div>
          <label className="label" htmlFor="support-model">{t('خودرو یا برند مورد نظر', 'Vehicle or brand')}</label>
          <input id="support-model" name="model" required maxLength={80} placeholder={t('مثلاً لکسوس LX 600', 'e.g. Lexus LX 600')} className="field" />
        </div>
      )}

      <div>
        <label className="label" htmlFor="support-message">{t('متن پیام', 'Message')}</label>
        <textarea id="support-message" name="message" required minLength={5} maxLength={1200} rows={5} className="field" placeholder={t('چند خط صمیمی بنویسید تا سریع‌تر کمکتان کنیم…', 'Tell us what happened in a few friendly lines...')} />
      </div>

      {status === 'error' && <p className="error-text" role="alert">{error}</p>}

      <button type="submit" className="btn-cta flex w-full items-center justify-center gap-2 text-sm" disabled={status === 'sending'}>
        {status === 'sending' ? (
          <>
            <CarLoader size="sm" label={t('در حال ارسال', 'Sending')} />
            {t('در حال ارسال…', 'Sending...')}
          </>
        ) : (
          t('ارسال و دریافت کد پیگیری', 'Send and get a tracking code')
        )}
      </button>
    </form>
  );
}
