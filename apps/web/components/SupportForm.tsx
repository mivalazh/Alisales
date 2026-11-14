'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { CarLoader } from './CarLoader';
import { CustomSelect } from './CustomSelect';
import { pushLocalNotification } from '@/lib/local-notifications';

type Kind = 'brand' | 'ticket';
export type SupportTopic = 'technical' | 'advertising' | 'suggestion' | 'report';

const TOPICS: ReadonlyArray<{ value: SupportTopic; fa: string; en: string }> = [
  { value: 'technical', fa: 'پشتیبانی و سوال فنی', en: 'Technical support' },
  { value: 'advertising', fa: 'همکاری و تبلیغات', en: 'Partnership & advertising' },
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
  initialTopic?: SupportTopic;
}) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ code: string; reply: string | null } | null>(null);
  const [topic, setTopic] = useState<SupportTopic>(initialTopic ?? 'technical');
  const [partnership, setPartnership] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const selectedTopic: SupportTopic =
      kind === 'brand' ? 'suggestion' : partnership ? 'advertising' : topic;
    const isPartnership = kind === 'ticket' && partnership;
    const payload = {
      kind,
      topic: selectedTopic,
      name: isPartnership ? 'همکاری با ما' : String(form.get('name') ?? '').trim(),
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
            <p className="font-extrabold text-ink">
              {partnership ? t('درخواست همکاری ثبت شد', 'Partnership request received') : t('تیکت شما ثبت شد', 'Your ticket is in')}
            </p>
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
            'کد پیگیری را نگه دارید؛ همین درخواست و پاسخ آن در بخش «تیکت‌های من» قابل مشاهده است.',
            'Keep the code; this request and its reply appear in My tickets.',
          )}
        </p>
        <button type="button" onClick={() => setStatus('idle')} className="btn-ghost mt-4 text-sm">
          {t('ثبت درخواست دیگر', 'Submit another request')}
        </button>
      </div>
    );
  }

  const isPartnership = kind === 'ticket' && partnership;

  return (
    <form id="ticket" onSubmit={onSubmit} className="scroll-mt-24 space-y-3.5 rounded-card border border-line bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-ink">
            {kind === 'brand'
              ? t('پیشنهاد برند یا قابلیت', 'Suggest a brand or feature')
              : isPartnership
                ? t('همکاری با ما', 'Partner with us')
                : t('ثبت تیکت پشتیبانی', 'Open a support ticket')}
          </h1>
          <p className="mt-1 text-xs leading-6 text-muted">
            {isPartnership
              ? t('موضوع، شماره تماس و متن پیام را بنویسید.', 'Tell us the subject, phone and message.')
              : t(
                  'هر تیکت یک کد پیگیری می‌گیرد و پاسخ تیم پشتیبانی همین‌جا ثبت می‌شود.',
                  'Every ticket gets a tracking code and the reply appears right here.',
                )}
          </p>
        </div>
        {kind === 'ticket' && !isPartnership && (
          <button
            type="button"
            onClick={() => {
              setPartnership(true);
              setTopic('advertising');
            }}
            className="rounded-[var(--radius-pill)] border border-cta bg-cta-soft px-3 py-1.5 text-xs font-extrabold text-ink transition hover:bg-cta/20"
          >
            {t('همکاری با ما', 'Partner with us')}
          </button>
        )}
        {isPartnership && (
          <button
            type="button"
            onClick={() => setPartnership(false)}
            className="rounded-[var(--radius-pill)] border border-line px-3 py-1.5 text-xs font-bold text-muted transition hover:border-line-strong hover:text-ink"
          >
            {t('بازگشت به تیکت پشتیبانی', 'Back to support ticket')}
          </button>
        )}
      </div>

      {kind === 'ticket' && !isPartnership && (
        <div>
          <span className="label">{t('موضوع درخواست', 'Request topic')}</span>
          <CustomSelect
            value={topic}
            onChange={(next) => setTopic(next as SupportTopic)}
            ariaLabel={t('موضوع درخواست', 'Request topic')}
            options={TOPICS.map((item) => ({
              value: item.value,
              label: lang === 'en' ? item.en : item.fa,
            }))}
          />
          <input type="hidden" name="topic" value={topic} />
        </div>
      )}

      {isPartnership ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="support-subject">{t('موضوع', 'Subject')}</label>
            <input id="support-subject" name="model" required minLength={2} maxLength={80} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="support-contact">{t('شماره تماس', 'Phone number')}</label>
            <input id="support-contact" name="contact" required minLength={5} maxLength={80} dir="ltr" className="field" />
          </div>
        </div>
      ) : (
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
      )}

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
        ) : isPartnership ? (
          t('ارسال درخواست همکاری', 'Send partnership request')
        ) : (
          t('ارسال و دریافت کد پیگیری', 'Send and get a tracking code')
        )}
      </button>
    </form>
  );
}
