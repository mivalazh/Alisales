'use client';

import { useState, type FormEvent } from 'react';
import {
  MESSAGE_KIND_LABELS,
  VISIT_REQUEST_DEFAULT_MESSAGE,
  visitSlotLabel,
  type MessageKind,
  type VisitSlot,
} from '@alisales/schemas';

export interface ThreadMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  kind?: MessageKind;
  visit?: VisitSlot | null;
}

/**
 * Conversation view: message bubbles, the composer, and the structured visit
 * request flow (`visit_request_chat`).
 *
 * The buyer asks for a visit with an optional date/time; the seller accepts the
 * proposed slot or proposes a counter-time. Role rules and message bodies are
 * enforced server-side (`/api/messages`); this component only drives the UI.
 */
export function ChatThread({
  conversationId,
  currentUserId,
  isSeller,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  isSeller: boolean;
  initialMessages: ThreadMessage[];
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'none' | 'request' | 'counter'>('none');
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('');

  // Latest proposal that came from the other side (seller can answer it).
  const lastProposal =
    [...messages]
      .reverse()
      .find(
        (m) =>
          (m.kind === 'visit_request' || m.kind === 'visit_counter') &&
          m.senderId !== currentUserId,
      ) ?? null;

  function currentSlot(): VisitSlot {
    return { date: visitDate || null, time: visitTime || null };
  }

  function resetPanel(): void {
    setPanel('none');
    setVisitDate('');
    setVisitTime('');
  }

  async function post(payload: Record<string, unknown>): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, ...payload }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: ThreadMessage;
        error?: string;
      };
      if (res.ok && data.message) {
        setMessages((current) => [...current, data.message as ThreadMessage]);
        resetPanel();
        setText('');
        return;
      }
      setError(data.error ?? 'ارسال پیام ناموفق بود.');
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    await post({ body });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {messages.length === 0 && (
          <li className="rounded-card border border-dashed border-line-strong bg-card px-4 py-8 text-center text-sm text-muted">
            هنوز پیامی رد و بدل نشده است؛ اولین پیام را بفرستید.
          </li>
        )}
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          const structured = message.kind && message.kind !== 'text';
          return (
            <li key={message.id} className={mine ? 'self-start' : 'self-end'}>
              <div
                className={`max-w-[80vw] rounded-card px-3 py-2 text-sm ${
                  mine ? 'bg-cta-soft text-ink' : 'border border-line bg-card text-ink'
                }`}
              >
                {structured && (
                  <p className="mb-1 flex flex-wrap items-center gap-1 text-xs font-extrabold">
                    <span className="rounded-[var(--radius-pill)] border border-line bg-page px-2 py-0.5">
                      {MESSAGE_KIND_LABELS[message.kind as MessageKind]}
                    </span>
                    {message.visit && (
                      <span dir="ltr" className="font-bold text-muted">
                        {visitSlotLabel(message.visit)}
                      </span>
                    )}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{message.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {!isSeller && panel === 'none' && (
        <button
          type="button"
          onClick={() => setPanel('request')}
          className="btn-ghost self-start text-xs"
        >
          درخواست بازدید
        </button>
      )}

      {!isSeller && panel === 'request' && (
        <div className="rounded-card border border-line bg-card p-3">
          <p className="text-sm font-extrabold">درخواست بازدید</p>
          <p className="mt-1 text-xs text-muted">{VISIT_REQUEST_DEFAULT_MESSAGE}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-bold">
              تاریخ (اختیاری)
              <input
                type="date"
                dir="ltr"
                className="field mt-1"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </label>
            <label className="text-xs font-bold">
              ساعت (اختیاری)
              <input
                type="time"
                dir="ltr"
                className="field mt-1"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void post({ kind: 'visit_request', visit: currentSlot() })}
              className="btn-cta text-xs disabled:opacity-60"
            >
              {busy ? 'در حال ارسال…' : 'ارسال درخواست'}
            </button>
            <button type="button" onClick={resetPanel} className="btn-ghost text-xs">
              انصراف
            </button>
          </div>
        </div>
      )}

      {isSeller && lastProposal && panel === 'none' && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-card p-3">
          <p className="text-xs font-bold">
            زمان پیشنهادی:{' '}
            <span dir="ltr">{visitSlotLabel(lastProposal.visit ?? null)}</span>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void post({ kind: 'visit_accept', visit: lastProposal.visit ?? null })}
            className="btn-cta text-xs disabled:opacity-60"
          >
            تأیید زمان
          </button>
          <button type="button" onClick={() => setPanel('counter')} className="btn-ghost text-xs">
            پیشنهاد زمان دیگر
          </button>
        </div>
      )}

      {isSeller && panel === 'counter' && (
        <div className="rounded-card border border-line bg-card p-3">
          <p className="text-sm font-extrabold">پیشنهاد زمان دیگر</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-bold">
              تاریخ
              <input
                type="date"
                dir="ltr"
                className="field mt-1"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </label>
            <label className="text-xs font-bold">
              ساعت
              <input
                type="time"
                dir="ltr"
                className="field mt-1"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || (!visitDate && !visitTime)}
              onClick={() => void post({ kind: 'visit_counter', visit: currentSlot() })}
              className="btn-cta text-xs disabled:opacity-60"
            >
              {busy ? 'در حال ارسال…' : 'ارسال پیشنهاد'}
            </button>
            <button type="button" onClick={resetPanel} className="btn-ghost text-xs">
              انصراف
            </button>
          </div>
        </div>
      )}

      <form onSubmit={(e) => void send(e)} className="flex items-end gap-2">
        <label htmlFor="message" className="sr-only">
          متن پیام
        </label>
        <textarea
          id="message"
          className="field min-h-11 flex-1 resize-y"
          rows={2}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="پیام خود را بنویسید…"
        />
        <button type="submit" disabled={busy || text.trim().length === 0} className="btn-cta text-sm disabled:opacity-60">
          {busy ? 'در حال ارسال…' : 'ارسال'}
        </button>
      </form>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
