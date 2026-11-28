'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/lib/i18n';
import { statusLabel, STATUS_PILL, formatStamp } from './status';
import type { ThreadMessage, TicketStatus } from './types';

/**
 * One ticket conversation.
 *
 * RTL reading order: the account's messages sit on the start (right) edge in
 * navy, support replies on the end (left) edge in the cream card with the
 * «پشتیبانی علی‌سیلز» label. The list auto-scrolls to the newest message and
 * the composer sends with Enter (Shift+Enter adds a line).
 */
export function TicketThread({
  subject,
  code,
  status,
  messages,
  role,
  onSend,
  onBack,
  headerAction,
  composerNote,
  emptyLabel,
}: {
  subject: string;
  code: string;
  status: TicketStatus;
  messages: ThreadMessage[];
  /** Whose view this is — both sides read the same chronology. */
  role: 'user' | 'admin';
  onSend?: (body: string) => Promise<boolean>;
  onBack?: () => void;
  headerAction?: ReactNode;
  /** Replaces the composer (closed ticket, guest, loading). */
  composerNote?: string;
  emptyLabel?: string;
}) {
  const { t, lang } = useI18n();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  async function submit(): Promise<void> {
    const body = draft.trim();
    if (!body || !onSend || sending) return;
    setSending(true);
    setError(null);
    try {
      const ok = await onSend(body);
      if (ok) setDraft('');
      else setError(t('ارسال پیام انجام نشد؛ دوباره تلاش کنید.', 'Could not send; please try again.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-card/95 px-3 py-2.5 backdrop-blur-md sm:px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label={t('بازگشت به تیکت‌ها', 'Back to tickets')}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-line-strong lg:hidden"
          >
            <Icon name="chevronRight" size={18} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-ink">{subject}</p>
          <p className="mt-0.5 flex items-center gap-2 text-[10px] font-bold text-faint">
            <bdi dir="ltr">{code}</bdi>
            <span aria-hidden>·</span>
            <span>{role === 'admin' ? t('نمای پشتیبانی', 'Support view') : t('گفتگو', 'Conversation')}</span>
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${STATUS_PILL[status]}`}
        >
          {statusLabel(status, lang)}
        </span>
        {headerAction}
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-page/60 px-3 py-4 sm:px-4">
        {messages.length === 0 ? (
          <p className="mx-auto max-w-xs rounded-xl border border-dashed border-line bg-card px-4 py-8 text-center text-xs leading-6 text-muted">
            {emptyLabel ?? t('هنوز پیامی در این گفتگو نیست.', 'No messages in this conversation yet.')}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {messages.map((message) => {
              const mine = message.senderRole === 'user';
              return (
                <li key={message.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-xs ${
                      mine
                        ? 'rounded-es-sm bg-[#111144] text-white'
                        : 'rounded-ee-sm border border-line bg-[#F4F1EC] text-ink dark:bg-white/10'
                    }`}
                  >
                    {!mine && (
                      <p className="mb-1 text-[11px] font-extrabold text-[#111144] dark:text-[#F98513]">
                        {t('پشتیبانی علی‌سیلز', 'Ali Sales support')}
                      </p>
                    )}
                    <p className="whitespace-pre-line break-words">{message.body}</p>
                    {message.attachmentUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.attachmentUrl}
                        alt={t('پیوست تیکت', 'Ticket attachment')}
                        width={640}
                        height={480}
                        className="mt-2 max-h-52 w-full rounded-lg object-cover"
                      />
                    )}
                    <p
                      className={`mt-1.5 text-[10px] tabular-nums ${
                        mine ? 'text-white/60' : 'text-muted'
                      }`}
                    >
                      {formatStamp(message.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-line bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-4">
        {composerNote ? (
          <p className="rounded-xl bg-page px-3 py-2.5 text-center text-xs font-bold text-muted">
            {composerNote}
          </p>
        ) : (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              className="flex items-end gap-2"
            >
              <label className="min-w-0 flex-1">
                <span className="sr-only">{t('متن پیام', 'Message')}</span>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.shiftKey) return;
                    event.preventDefault();
                    void submit();
                  }}
                  rows={1}
                  maxLength={4000}
                  disabled={sending}
                  placeholder={t('پیام خود را بنویسید…', 'Write your message…')}
                  className="field max-h-32 min-h-12 w-full resize-y py-2.5 text-[16px] leading-6"
                />
              </label>
              <button
                type="submit"
                disabled={sending || draft.trim().length === 0}
                aria-label={t('ارسال پیام', 'Send message')}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#111144] text-white transition hover:bg-[#1b1b5c] disabled:opacity-50 dark:bg-[#F98513] dark:text-[#111144]"
              >
                {sending ? (
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-[#111144]/40 dark:border-t-[#111144]"
                  />
                ) : (
                  <Icon name="arrowUp" size={20} />
                )}
              </button>
            </form>
            {error && (
              <p className="error-text" role="alert">
                {error}
              </p>
            )}
            <p className="mt-1 text-[10px] text-faint">
              {t('Enter برای ارسال · Shift + Enter برای خط جدید', 'Enter to send · Shift + Enter for a new line')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
