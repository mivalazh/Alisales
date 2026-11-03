'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Icon } from './Icon';

export interface ThreadMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  kind?: string;
  visit?: unknown;
}

/** Local-time clock for a message — rendered after mount so SSR and client agree. */
function clock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Conversation view: a standard buyer ↔ seller message thread.
 *
 * Everything is a plain text bubble with its time underneath — no structured
 * visit-request widgets, no slots, no counters. Role rules and message bodies
 * are still enforced server-side (`/api/messages`); this component only drives
 * the composer and the thread.
 */
export function ChatThread({
  conversationId,
  currentUserId,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: ThreadMessage[];
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => setMounted(true), []);

  // Keep the newest message in view, like every messaging app.
  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  async function send(event?: FormEvent<HTMLFormElement>): Promise<void> {
    event?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, body }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: ThreadMessage;
        error?: string;
      };
      if (res.ok && data.message) {
        setMessages((current) => [...current, data.message as ThreadMessage]);
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

  /** Enter sends, Shift+Enter starts a new line. */
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul
        ref={listRef}
        aria-label="پیام‌ها"
        className="flex max-h-[62vh] min-h-[240px] flex-col gap-2 overflow-y-auto rounded-card border border-line bg-page p-3"
      >
        {messages.length === 0 && (
          <li className="m-auto max-w-xs text-center text-sm text-muted">
            هنوز پیامی رد و بدل نشده است؛ اولین پیام را بفرستید.
          </li>
        )}
        {messages.map((message) => {
          const mine = message.senderId === currentUserId;
          return (
            <li key={message.id} className={`flex flex-col ${mine ? 'items-start' : 'items-end'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-6 ${
                  mine ? 'bg-cta-soft text-ink' : 'border border-line bg-card text-ink'
                }`}
              >
                {message.body}
              </div>
              <time
                dateTime={message.createdAt}
                className="mt-1 text-[10px] font-semibold text-faint"
              >
                {mounted ? clock(message.createdAt) : ''}
              </time>
            </li>
          );
        })}
      </ul>

      <form onSubmit={(e) => void send(e)} className="flex items-end gap-2">
        <label htmlFor="message" className="sr-only">
          متن پیام
        </label>
        <textarea
          id="message"
          className="field min-h-11 flex-1 resize-none"
          rows={1}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="پیام خود را بنویسید…"
        />
        <button
          type="submit"
          disabled={busy || text.trim().length === 0}
          aria-label="ارسال پیام"
          className="btn-cta h-11 w-11 shrink-0 p-0 disabled:opacity-50"
        >
          <Icon name="send" size={18} />
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
