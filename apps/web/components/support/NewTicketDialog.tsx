'use client';

import { useEffect, useRef, useState } from 'react';
import { CustomSelect } from '@/components/CustomSelect';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/lib/i18n';
import {
  PhotoPipelineError,
  processListingPhoto,
  uploadProcessedPhoto,
} from '@/lib/photos';

const TOPICS = [
  { value: 'technical', fa: 'پشتیبانی و سوال فنی', en: 'Technical support' },
  { value: 'advertising', fa: 'همکاری و تبلیغات', en: 'Partnership & advertising' },
  { value: 'suggestion', fa: 'پیشنهاد برند یا قابلیت جدید', en: 'Suggest a brand or feature' },
  { value: 'report', fa: 'گزارش مشکل آگهی', en: 'Report a listing problem' },
] as const;

export type NewTicketTopic = (typeof TOPICS)[number]['value'];

/**
 * «تیکت جدید» dialog: category, subject, the first message and one optional
 * image. Signed-in sellers never retype their contact details — the API fills
 * them from the session; guests still provide a name and phone/email.
 */
export function NewTicketDialog({
  open,
  authed,
  defaultTopic = 'technical',
  onClose,
  onCreated,
}: {
  open: boolean;
  authed: boolean;
  defaultTopic?: NewTicketTopic;
  onClose: () => void;
  onCreated: (ticket: { id: string; code: string }) => void;
}) {
  const { t, lang } = useI18n();
  const [topic, setTopic] = useState<NewTicketTopic>(defaultTopic);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [attachment, setAttachment] = useState<{ url: string; path: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  async function pickFile(file: File | undefined): Promise<void> {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const processed = await processListingPhoto(file);
      const uploaded = await uploadProcessedPhoto(processed);
      if (!uploaded.url) throw new PhotoPipelineError('');
      setAttachment({ url: uploaded.url, path: uploaded.path ?? '' });
    } catch (e) {
      setError(
        e instanceof PhotoPipelineError && e.message
          ? e.message
          : t('بارگذاری تصویر ناموفق بود.', 'Could not upload the image.'),
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (sending || uploading) return;
    setError(null);
    if (subject.trim().length < 3) {
      setError(t('موضوع تیکت را کامل‌تر بنویسید.', 'Make the subject a little longer.'));
      return;
    }
    if (message.trim().length < 5) {
      setError(t('متن پیام را کامل‌تر بنویسید.', 'Write a little more in the message.'));
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          topic,
          subject: subject.trim(),
          message: message.trim(),
          attachmentUrl: attachment?.url ?? null,
          name: authed ? undefined : name.trim(),
          contact: authed ? undefined : contact.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        code?: string;
        error?: string;
      };
      if (!res.ok || !data.id || !data.code) {
        setError(data.error ?? t('ثبت تیکت انجام نشد؛ دوباره تلاش کنید.', 'Could not create the ticket.'));
        return;
      }
      setSubject('');
      setMessage('');
      setAttachment(null);
      onCreated({ id: data.id, code: data.code });
    } catch {
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not reach the server.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#111144]/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('تیکت جدید', 'New ticket')}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#111144]/8 text-[#111144] dark:bg-white/10 dark:text-[#F4F1EC]">
            <Icon name="message" size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-ink">{t('تیکت جدید', 'New ticket')}</p>
            <p className="mt-0.5 text-[11px] text-muted">
              {t('موضوع، دسته و پیام اول را مشخص کنید.', 'Set a subject, a category and the first message.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('بستن', 'Close')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-cta-soft hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div>
            <span className="label">{t('دسته‌بندی', 'Category')}</span>
            <CustomSelect
              value={topic}
              onChange={(next) => setTopic(next as NewTicketTopic)}
              ariaLabel={t('دسته‌بندی تیکت', 'Ticket category')}
              options={TOPICS.map((item) => ({
                value: item.value,
                label: lang === 'en' ? item.en : item.fa,
              }))}
            />
          </div>

          <div>
            <label className="label" htmlFor="ticket-subject">
              {t('موضوع', 'Subject')}
            </label>
            <input
              id="ticket-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              maxLength={120}
              required
              minLength={3}
              className="field"
              placeholder={t('مثلاً مشکل در انتشار آگهی', 'e.g. Problem publishing a listing')}
            />
          </div>

          {!authed && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ticket-name">
                  {t('نام و نام خانوادگی', 'Full name')}
                </label>
                <input
                  id="ticket-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={80}
                  className="field"
                />
              </div>
              <div>
                <label className="label" htmlFor="ticket-contact">
                  {t('موبایل یا ایمیل', 'Mobile or email')}
                </label>
                <input
                  id="ticket-contact"
                  value={contact}
                  onChange={(event) => setContact(event.target.value)}
                  required
                  minLength={5}
                  maxLength={80}
                  dir="ltr"
                  className="field"
                />
              </div>
            </div>
          )}

          <div>
            <label className="label" htmlFor="ticket-message">
              {t('پیام', 'Message')}
            </label>
            <textarea
              id="ticket-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              required
              minLength={5}
              maxLength={4000}
              className="field resize-y"
              placeholder={t('جزئیات مشکل یا درخواست را بنویسید…', 'Describe the issue or request…')}
            />
          </div>

          <div>
            <span className="label">{t('تصویر (اختیاری)', 'Image (optional)')}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-page px-3 text-xs font-bold text-ink transition hover:border-cta disabled:opacity-60"
              >
                <Icon name="camera" size={16} />
                {uploading
                  ? t('در حال بارگذاری…', 'Uploading…')
                  : t('افزودن تصویر', 'Add image')}
              </button>
              {attachment && (
                <span className="relative h-11 w-11 overflow-hidden rounded-lg border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachment.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    aria-label={t('حذف تصویر', 'Remove image')}
                    className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-bold text-white"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              hidden
              onChange={(event) => void pickFile(event.target.files?.[0])}
            />
          </div>

          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost text-sm">
              {t('انصراف', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={sending || uploading}
              className="btn-cta text-sm disabled:opacity-60"
            >
              {sending ? t('در حال ارسال…', 'Sending…') : t('ثبت تیکت', 'Create ticket')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
